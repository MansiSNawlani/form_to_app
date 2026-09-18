"""An Anlagenspeicher over any S3-compatible object store.

The store for a platform with no persistent disk. app/anlagen/speicher.py holds
the interface and the reasoning behind its three rules; this file is only how
those rules are kept against S3.

**S3-compatible rather than one provider's own storage.** Decided on 2026-09-18.
project-overview.md puts the deployment on an FFS-approved platform running
Docker containers, so any one host is a stop on the way rather than the
destination. The same class runs against Cloudflare R2, Amazon, or a MinIO server
FFS host themselves, changing settings only. These are photographs attached to
German government survey records, so where they physically sit has to stay FFS's
decision rather than something the code settled.

**boto3 through worker threads, not an async S3 client.** Every call here blocks,
exactly as the disk calls in speicher.py do, and is wrapped the same way. One
concurrency story in the package rather than two, and no dependency on a
less-maintained async wrapper. The low-level boto3 client is safe to share
between threads; its resource objects are not, so this file uses only the client.

**There are no directories.** A key is one flat string that happens to contain a
slash. loesche_protokoll is therefore a prefix sweep rather than the single
removal the filesystem allows, which is the one place the two stores genuinely
differ in shape rather than only in mechanism.
"""

import asyncio
import uuid
from collections.abc import AsyncIterable, AsyncIterator
from tempfile import SpooledTemporaryFile
from typing import TYPE_CHECKING, Any

import boto3
from botocore.exceptions import ClientError

from app.anlagen.speicher import BLOCKGROESSE, SCHLUESSEL_MUSTER, SchluesselUngueltig

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client
    from mypy_boto3_s3.type_defs import GetObjectOutputTypeDef, ObjectIdentifierTypeDef
else:
    S3Client = Any

# What S3 says when the object is not there. Three spellings because the answer
# depends on the call: get_object says NoSuchKey, head_object has no body to put
# a code in and surfaces as the bare status, and some S3-compatible
# implementations prefer NotFound. Treating any of them as "not there" is what
# keeps a missing photograph a 404 rather than a 500.
NICHT_VORHANDEN = frozenset({"404", "NoSuchKey", "NoSuchBucket", "NotFound"})

# Below this an upload never touches a disk at all. A protocol's photographs are
# capped at 10 MB each, so the common case is a few megabytes held in memory for
# the length of one request; anything larger spills to a temporary file rather
# than growing the process. On a serverless platform that temporary file lands in
# the one scratch directory such platforms do allow, which is exactly what it is
# for: it lives for one request and nothing expects it to survive.
PUFFER_IM_SPEICHER = 4 * 1024 * 1024


def _ist_nicht_vorhanden(fehler: ClientError) -> bool:
    code = str(fehler.response.get("Error", {}).get("Code", ""))
    return code in NICHT_VORHANDEN


class S3Speicher:
    """Anlagenspeicher over one bucket.

    The endpoint is configuration rather than a hard-coded Amazon address,
    because that is the whole point: the same class reaches R2, Amazon or MinIO
    depending on what a deployment was given.
    """

    def __init__(
        self,
        *,
        bucket: str,
        endpoint: str | None,
        region: str,
        zugriffsschluessel: str,
        geheimschluessel: str,
    ) -> None:
        self.bucket = bucket
        self._client: S3Client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=zugriffsschluessel,
            aws_secret_access_key=geheimschluessel,
        )

    def _geprueft(self, schluessel: str) -> str:
        """The same guard the disk store applies, for the same reason.

        A key that this application did not build has no business reaching the
        bucket, whether or not the store it reaches has directories to escape.
        """
        if not SCHLUESSEL_MUSTER.fullmatch(schluessel):
            raise SchluesselUngueltig(f"Not a storage key: {schluessel!r}")
        return schluessel

    async def schreibe(self, schluessel: str, bloecke: AsyncIterable[bytes]) -> int:
        """Buffer the accepted blocks, then send them as one object.

        Unlike a file, an object cannot be appended to, so the bytes have to be
        complete before the upload starts. The buffer holds only what the caller
        has already accepted: the stream is still consumed a block at a time, so
        a caller enforcing a size cap still raises part way through and still
        stops an oversized upload early. Nothing has been sent at that point, so
        a refusal leaves the bucket untouched.

        **Nothing is deleted when the upload itself fails, unlike the disk
        store.** That difference is the point rather than an oversight. A file
        opened "wb" is truncated the instant it is opened, so a half written file
        is already damage and removing it is the repair. S3 replaces an object
        only once the upload completes, so a failure leaves either the previous
        object untouched or no object at all, and both already satisfy the
        interface. Deleting here would take a good photograph away because the
        upload that meant to replace it lost its connection, which is the one
        outcome this whole file exists to prevent. Found on 2026-09-18 by testing
        the cleanup path that an earlier draft of this method had.
        """
        self._geprueft(schluessel)

        geschrieben = 0
        with SpooledTemporaryFile(max_size=PUFFER_IM_SPEICHER) as puffer:
            async for block in bloecke:
                await asyncio.to_thread(puffer.write, block)
                geschrieben += len(block)
            await asyncio.to_thread(puffer.seek, 0)

            await asyncio.to_thread(
                self._client.upload_fileobj, puffer, self.bucket, schluessel
            )

        return geschrieben

    async def lies(self, schluessel: str) -> bytes | None:
        antwort = await self._hole(schluessel)
        if antwort is None:
            return None
        try:
            return bytes(await asyncio.to_thread(antwort["Body"].read))
        finally:
            await asyncio.to_thread(antwort["Body"].close)

    async def existiert(self, schluessel: str) -> bool:
        try:
            await asyncio.to_thread(
                self._client.head_object, Bucket=self.bucket, Key=self._geprueft(schluessel)
            )
        except ClientError as fehler:
            if _ist_nicht_vorhanden(fehler):
                return False
            raise
        return True

    async def bloecke(self, schluessel: str) -> AsyncIterator[bytes]:
        """Stream the object's body, a block at a time.

        An object that has gone missing between the existiert() check and here
        yields nothing rather than raising. The response has already begun by the
        time this runs, so there is no status code left to change: an empty body
        is the only honest thing left to send.
        """
        antwort = await self._hole(schluessel)
        if antwort is None:
            return

        koerper = antwort["Body"]
        try:
            while block := await asyncio.to_thread(koerper.read, BLOCKGROESSE):
                yield bytes(block)
        finally:
            await asyncio.to_thread(koerper.close)

    async def loesche(self, schluessel: str) -> None:
        """S3 answers a delete of something absent with success, which is the
        quiet delete the interface asks for, so there is nothing to catch."""
        await asyncio.to_thread(
            self._client.delete_object, Bucket=self.bucket, Key=self._geprueft(schluessel)
        )

    async def loesche_protokoll(self, submission_id: uuid.UUID) -> None:
        """Every object under the protocol's prefix.

        Paged, because a bucket lists at most a thousand keys at a time and
        delete_objects takes at most a thousand per call. A protocol holds at
        most twenty-one attachments, so one page is the real case; the loop is
        here so that the limit is the bucket's rather than an assumption of ours.
        """
        praefix = f"{submission_id}/"
        seiten = await asyncio.to_thread(
            lambda: list(
                self._client.get_paginator("list_objects_v2").paginate(
                    Bucket=self.bucket, Prefix=praefix
                )
            )
        )

        for seite in seiten:
            schluessel: list[ObjectIdentifierTypeDef] = [
                {"Key": eintrag["Key"]} for eintrag in seite.get("Contents", [])
            ]
            if schluessel:
                await asyncio.to_thread(
                    self._client.delete_objects,
                    Bucket=self.bucket,
                    Delete={"Objects": schluessel},
                )

    async def _hole(self, schluessel: str) -> "GetObjectOutputTypeDef | None":
        """get_object, or None when the object is not there.

        Shared by lies() and bloecke() because both need the same translation of
        a missing key into the interface's "no", and neither may let it become an
        exception the route above would report as a broken server.
        """
        try:
            return await asyncio.to_thread(
                self._client.get_object, Bucket=self.bucket, Key=self._geprueft(schluessel)
            )
        except ClientError as fehler:
            if _ist_nicht_vorhanden(fehler):
                return None
            raise
