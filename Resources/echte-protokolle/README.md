# Real filled-in protocols

Completed Protokoll E-Befischung files, for testing the PDF import of feature 23 against
protocols this project did not write. **The files themselves are deliberately not in git.**
`.gitignore` keeps everything in this directory out except this README.

## Why they are not committed

A filed protocol carries the surveyor's name, postal address, telephone number and e-mail
address, and often the name and telephone number of the Fischereiausübungsberechtigter as well.
Nobody has consented to that being published in a repository, and a repository is forever.

The blank forms in `../Fiaka_Resources/` are a different matter and are committed: they carry
nobody's data.

## What they are for

The automated tests never read this directory. They build their own filled protocol from the
blank form, which is deterministic and carries no personal data; `backend/app/formular/beispiele.py`
explains that and names its one weakness, that a file we wrote cannot prove how a file Acrobat
wrote is stored.

These files are what closes that gap, by hand, when a question comes up that only a real
protocol can answer. The first such question was how Acrobat stores a number the form displays
as `14,4`.

## What they showed

Read on 2026-09-22, and the answer was not what feature 23a assumed.

**All three are older form versions than the application serves.** Two say
`Version 2023-02-25` and one says `Version 2024-01-10`; the application's seed is `20260609`.
So the version gate in `app/protokolle/einlesen/version.py` refuses all three, which means it
would refuse the FFS backlog that feature 23 exists to read. That is a decision for FFS and the
project rather than a bug: see the note in the feature's spec.

## If you have more

Drop them in this directory. Do not rename them to look like fixtures, and do not point a test
at them: a test that only passes on one machine is worse than no test.
