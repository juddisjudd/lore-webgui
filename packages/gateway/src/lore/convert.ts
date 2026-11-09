import { timestampMs } from "@bufbuild/protobuf/wkt"
import type * as Domain from "@lore-webui/api"
import type { Lock } from "../gen/lock_pb.ts"
import type { Address, Branch, Repository, RevisionIdentifier } from "../gen/lore/model/v1/model_pb.ts"
import {
	Action,
	type DiffChange,
	MetadataType,
	NodeType,
	type Revision,
	type Revision_Parent,
	type TreeNode
} from "../gen/lore/thin_client/v1/model_pb.ts"

export const ZERO_SIGNATURE = new Uint8Array(32)

export const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex")

export const fromHex = (hex: string): Uint8Array | undefined =>
	/^(?:[0-9a-f]{2})+$/i.test(hex) ? new Uint8Array(Buffer.from(hex, "hex")) : undefined

export const isZero = (bytes: Uint8Array): boolean => bytes.every((b) => b === 0)

export const isId = (value: string): boolean => /^[0-9a-f]{32}$/i.test(value)

export const addressToString = (address: Address | undefined): string | null =>
	address && address.hash.length > 0 && !isZero(address.hash) ? `${toHex(address.hash)}-${toHex(address.context)}` : null

export const parseAddress = (value: string): { hash: Uint8Array; context: Uint8Array } | undefined => {
	const [hash, context = "", ...rest] = value.split("-")
	if (rest.length > 0 || hash === undefined) return undefined
	const hashBytes = fromHex(hash)
	const contextBytes = context === "" ? new Uint8Array(0) : fromHex(context)
	return hashBytes && contextBytes ? { hash: hashBytes, context: contextBytes } : undefined
}

export const repository = (r: Repository): Domain.Repository => ({
	id: toHex(r.id),
	name: r.name,
	description: r.description,
	defaultBranchId: toHex(r.defaultBranchId),
	defaultBranchName: r.defaultBranchName,
	creator: r.creator,
	created: Number(r.created)
})

export const branch = (b: Branch): Domain.Branch => ({
	id: toHex(b.id),
	name: b.name,
	creator: b.creator,
	category: b.category,
	created: Number(b.created),
	latest: b.latest.length > 0 && !isZero(b.latest) ? toHex(b.latest) : null,
	deleted: b.deleted,
	stack: b.stack.map((p) => ({ branchId: toHex(p.branchId), signature: toHex(p.revisionSignature) }))
})

export const fileLock = (lock: Lock): Domain.FileLock | null =>
	lock.resource
		? {
				path: lock.resource.description,
				branchId: toHex(lock.resource.branch),
				owner: lock.owner,
				lockedAt: lock.lockedAt ? timestampMs(lock.lockedAt) : null
			}
		: null

export const revisionRef = (signature: Uint8Array, identifier: RevisionIdentifier | undefined): Domain.RevisionRef => ({
	signature: toHex(signature),
	branchId: identifier ? toHex(identifier.branchId) : "",
	number: identifier ? Number(identifier.number) : 0
})

const parent = (p: Revision_Parent | undefined): Domain.RevisionRef | null =>
	p && p.signature.length > 0 && !isZero(p.signature) ? revisionRef(p.signature, p.identifier) : null

const metadataTypes: Record<MetadataType, Domain.MetadataType> = {
	[MetadataType.ADDRESS]: "address",
	[MetadataType.BOOLEAN]: "boolean",
	[MetadataType.BINARY]: "binary",
	[MetadataType.CONTEXT]: "context",
	[MetadataType.HASH]: "hash",
	[MetadataType.NUMERIC]: "numeric",
	[MetadataType.STRING]: "string"
}

export const revision = (r: Revision): Domain.Revision => ({
	signature: toHex(r.signature),
	branchId: r.identifier ? toHex(r.identifier.branchId) : "",
	number: Number(r.number || r.identifier?.number || 0n),
	message: r.commitMessage,
	timestamp: Number(r.timestamp),
	createdBy: r.createdBy,
	committedBy: r.committedBy,
	metadata: r.metadata.map((m) => ({ key: m.key, value: m.value, type: metadataTypes[m.metadataType] ?? "string" })),
	parent: parent(r.parentSelf),
	mergeParent: parent(r.parentOther)
})

const nodeKinds: Record<NodeType, Domain.NodeKind> = {
	[NodeType.DIRECTORY]: "directory",
	[NodeType.FILE]: "file",
	[NodeType.LINK]: "link"
}

const EXECUTABLE_MODE = 1n

export const treeEntry = (n: TreeNode): Domain.TreeEntry => ({
	path: n.path,
	name: n.path.slice(n.path.lastIndexOf("/") + 1),
	kind: nodeKinds[n.nodeType] ?? "file",
	address: n.nodeType === NodeType.DIRECTORY ? null : addressToString(n.address),
	size: Number(n.size),
	executable: (n.mode & EXECUTABLE_MODE) === EXECUTABLE_MODE,
	tracking: n.tracking
})

export const compareEntries = (a: Domain.TreeEntry, b: Domain.TreeEntry): number =>
	a.kind === "directory" && b.kind !== "directory"
		? -1
		: b.kind === "directory" && a.kind !== "directory"
			? 1
			: a.name.localeCompare(b.name, undefined, { numeric: true })

const sameContent = (a: Address | undefined, b: Address | undefined): boolean =>
	!!a && !!b && Buffer.from(a.hash).equals(Buffer.from(b.hash))

const action = (c: DiffChange): Domain.ChangeAction => {
	switch (c.action) {
		case Action.ADD:
			return "added"
		case Action.DELETE:
			return "deleted"
		case Action.MOVE:
			return "moved"
		case Action.COPY:
			return "copied"
		default:
			return sameContent(c.contentFrom, c.contentTo) ? "unchanged" : "modified"
	}
}

export const change = (c: DiffChange): Domain.Change => ({
	path: c.path,
	pathFrom: c.pathFrom === "" ? null : c.pathFrom,
	action: action(c),
	kind: nodeKinds[c.nodeType] ?? "file",
	contentFrom: c.nodeType === NodeType.DIRECTORY ? null : addressToString(c.contentFrom),
	contentTo: c.nodeType === NodeType.DIRECTORY ? null : addressToString(c.contentTo),
	automerged: c.automerged,
	linked: c.linkRepositoryIndex !== 0
})
