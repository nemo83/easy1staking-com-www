# Repository maintenance after history cleanup

The canonical branches are `main` for the production source and
`feat/rebrand-cutover` for the redesign, including the Editorial homepage and
supporting preview pages. Keeping the redesign on its branch does not publish it
or establish release readiness. The temporary build-repair branches are retired
as part of this cleanup.

History cleanup replaces forged commits with their verified original commits and
rebuilds descendant parent links. Approved application trees are preserved byte
for byte. The cleanup also consolidates reviewed product documentation, design
references and media on the redesign branch. It does not run or newly verify the
applications. Older commit IDs in verification records identify pre-rewrite
observations; changed commit IDs do not imply new runtime verification.

After the cleanup is published, a fresh clone is the preferred starting point.
Keep an old clone offline as evidence if needed. Do not merge an old branch into
either canonical branch: that can restore removed history. If unpublished work
must survive, review its changes as data and replay only the necessary changes
onto a fresh canonical checkout, then inspect and verify the result. Coordinate
any rebase with the repository owner and use the reviewed old-to-new commit map
to correlate historical records. Do not blindly push all old refs or mirror an
old clone.

Historical research and design-review files retain their original bytes. Their
startup instructions, branch descriptions, draft status and past build results
are historical evidence, not current execution guidance. For redesign scope and
reproduction, use [homepage-polish.md](homepage-polish.md) from the canonical
redesign branch. Inspect the source and startup scripts before installing or
running any historical checkout; never execute a recovered loader, editor
auto-task or file merely because it exists in old history.

Dependency findings, credential replacement and revocation, access review, old
deployment retirement and release verification remain separate maintenance work.
History cleanup does not prove that credentials were rotated, a host is clean,
dependencies are secure, or a public deployment has changed. Publicly exposed
browser configuration remains public after rotation; old deployments may retain
old embedded values.

A branch rewrite cannot erase copies in other clones, forks, cached commit
views, old deployment artifacts or Git hosting pull-request refs. Host-owned refs
may need separate handling with the hosting provider. Keep necessary forensic
evidence outside normal development history, coordinate collaborator recovery,
and verify the advertised canonical refs after publication. No public release or
security clearance is claimed by this maintenance record.
