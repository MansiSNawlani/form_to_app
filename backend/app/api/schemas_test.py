"""Response models pinned against the things they mirror.

Not a test of Pydantic. A test of the one place a model restates a fact that
lives somewhere else, where the copy can drift without anything failing.
"""

from app.api.schemas import Pruefstatus
from app.models.protokoll import Status


class TestPruefstatus:
    def test_kennt_jeden_zustand_ausser_entwurf(self) -> None:
        # A status added to the protocol later has to be decided about here too:
        # either the queue can be asked for it, or it cannot and somebody said so.
        # Without this, a new state would silently become unaskable.
        assert {zustand.value for zustand in Pruefstatus} == {
            zustand.value for zustand in Status
        } - {Status.DRAFT.value}

    def test_laesst_sich_in_einen_echten_status_uebersetzen(self) -> None:
        # The queue is asked in these and queried in Status, so every value here
        # has to be a value there.
        assert [Status(zustand.value) for zustand in Pruefstatus] == [
            Status.SUBMITTED,
            Status.IN_REVIEW,
            Status.NEEDS_CHANGES,
            Status.REJECTED,
            Status.ACCEPTED,
            Status.LOCKED,
        ]
