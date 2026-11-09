import { Schema } from "effect"

export const Repository = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.String,
	defaultBranchId: Schema.String,
	defaultBranchName: Schema.String,
	creator: Schema.String,
	created: Schema.Number
})
export type Repository = typeof Repository.Type

export const BranchPoint = Schema.Struct({
	branchId: Schema.String,
	signature: Schema.String
})
export type BranchPoint = typeof BranchPoint.Type

export const Branch = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	creator: Schema.String,
	category: Schema.String,
	created: Schema.Number,
	latest: Schema.NullOr(Schema.String),
	deleted: Schema.Boolean,
	stack: Schema.Array(BranchPoint)
})
export type Branch = typeof Branch.Type

export const RevisionRef = Schema.Struct({
	signature: Schema.String,
	branchId: Schema.String,
	number: Schema.Number
})
export type RevisionRef = typeof RevisionRef.Type

export const MetadataType = Schema.Literals(["address", "boolean", "binary", "context", "hash", "numeric", "string"])
export type MetadataType = typeof MetadataType.Type

export const MetadataEntry = Schema.Struct({
	key: Schema.String,
	value: Schema.String,
	type: MetadataType
})
export type MetadataEntry = typeof MetadataEntry.Type

export const Revision = Schema.Struct({
	signature: Schema.String,
	branchId: Schema.String,
	number: Schema.Number,
	message: Schema.String,
	timestamp: Schema.Number,
	createdBy: Schema.String,
	committedBy: Schema.String,
	metadata: Schema.Array(MetadataEntry),
	parent: Schema.NullOr(RevisionRef),
	mergeParent: Schema.NullOr(RevisionRef)
})
export type Revision = typeof Revision.Type

export const HistoryPage = Schema.Struct({
	items: Schema.Array(Revision),
	older: Schema.NullOr(Schema.String),
	newer: Schema.NullOr(Schema.String)
})
export type HistoryPage = typeof HistoryPage.Type

export const NodeKind = Schema.Literals(["directory", "file", "link"])
export type NodeKind = typeof NodeKind.Type

export const TreeEntry = Schema.Struct({
	path: Schema.String,
	name: Schema.String,
	kind: NodeKind,
	address: Schema.NullOr(Schema.String),
	size: Schema.Number,
	executable: Schema.Boolean,
	tracking: Schema.Boolean
})
export type TreeEntry = typeof TreeEntry.Type

export const TreeListing = Schema.Struct({
	revision: RevisionRef,
	entry: Schema.NullOr(TreeEntry),
	children: Schema.Array(TreeEntry)
})
export type TreeListing = typeof TreeListing.Type

export const FileLock = Schema.Struct({
	path: Schema.String,
	branchId: Schema.String,
	owner: Schema.String,
	lockedAt: Schema.NullOr(Schema.Number)
})
export type FileLock = typeof FileLock.Type

const LockChange = {
	user: Schema.String,
	branchIds: Schema.Array(Schema.String),
	paths: Schema.Array(Schema.String)
}

export const RepositoryEvent = Schema.Union([
	Schema.TaggedStruct("BranchPushed", {
		branchId: Schema.String,
		signature: Schema.String,
		number: Schema.Number,
		user: Schema.String
	}),
	Schema.TaggedStruct("BranchCreated", { branchId: Schema.String }),
	Schema.TaggedStruct("BranchDeleted", { branchId: Schema.String }),
	Schema.TaggedStruct("FilesLocked", LockChange),
	Schema.TaggedStruct("FilesUnlocked", LockChange)
])
export type RepositoryEvent = typeof RepositoryEvent.Type

export const ChangeAction = Schema.Literals(["added", "deleted", "modified", "moved", "copied", "unchanged"])
export type ChangeAction = typeof ChangeAction.Type

export const Change = Schema.Struct({
	path: Schema.String,
	pathFrom: Schema.NullOr(Schema.String),
	action: ChangeAction,
	kind: NodeKind,
	contentFrom: Schema.NullOr(Schema.String),
	contentTo: Schema.NullOr(Schema.String),
	automerged: Schema.Boolean,
	linked: Schema.Boolean
})
export type Change = typeof Change.Type

export const Conflict = Schema.Struct({
	ours: Change,
	theirs: Change
})
export type Conflict = typeof Conflict.Type

export const RevisionDiff = Schema.Struct({
	from: Schema.NullOr(RevisionRef),
	to: RevisionRef,
	base: Schema.NullOr(RevisionRef),
	changes: Schema.Array(Change),
	conflicts: Schema.Array(Conflict)
})
export type RevisionDiff = typeof RevisionDiff.Type

export const CompareStatus = Schema.Literals(["identical", "ahead", "behind", "diverged", "unrelated", "empty"])
export type CompareStatus = typeof CompareStatus.Type

export const BranchComparison = Schema.Struct({
	base: Branch,
	head: Branch,
	status: CompareStatus,
	mergeBase: Schema.NullOr(RevisionRef),
	ahead: Schema.NullOr(Schema.Number),
	behind: Schema.NullOr(Schema.Number),
	revisions: Schema.Array(Revision),
	changes: Schema.Array(Change),
	conflicts: Schema.Array(Conflict)
})
export type BranchComparison = typeof BranchComparison.Type

export const DiffLine = Schema.Struct({
	kind: Schema.Literals(["context", "add", "del"]),
	text: Schema.String,
	oldNo: Schema.NullOr(Schema.Number),
	newNo: Schema.NullOr(Schema.Number)
})
export type DiffLine = typeof DiffLine.Type

export const Hunk = Schema.Struct({
	oldStart: Schema.Number,
	oldLines: Schema.Number,
	newStart: Schema.Number,
	newLines: Schema.Number,
	lines: Schema.Array(DiffLine)
})
export type Hunk = typeof Hunk.Type

export const FileDiff = Schema.Struct({
	binary: Schema.Boolean,
	tooLarge: Schema.Boolean,
	added: Schema.Number,
	deleted: Schema.Number,
	hunks: Schema.Array(Hunk)
})
export type FileDiff = typeof FileDiff.Type

export const LanguageShare = Schema.Struct({
	name: Schema.String,
	bytes: Schema.Number,
	share: Schema.Number
})
export type LanguageShare = typeof LanguageShare.Type

export const CodeStats = Schema.Struct({
	total: Schema.Number,
	files: Schema.Number,
	languages: Schema.Array(LanguageShare)
})
export type CodeStats = typeof CodeStats.Type

export const AssetKind = Schema.Literals(["textures", "models", "audio", "video", "fonts", "unreal", "unity", "godot"])
export type AssetKind = typeof AssetKind.Type

export const AssetStats = Schema.Struct({
	kind: AssetKind,
	files: Schema.Number,
	bytes: Schema.Number
})
export type AssetStats = typeof AssetStats.Type

export const RepositoryStats = Schema.Struct({
	signature: Schema.NullOr(Schema.String),
	code: CodeStats,
	assets: Schema.Array(AssetStats)
})
export type RepositoryStats = typeof RepositoryStats.Type

export const ServerInfo = Schema.Struct({
	grpcUrl: Schema.String,
	httpUrl: Schema.String,
	reachable: Schema.Boolean,
	version: Schema.NullOr(Schema.String),
	authenticated: Schema.Boolean,
	compression: Schema.NullOr(Schema.String),
	oidcIssuer: Schema.NullOr(Schema.String),
	error: Schema.NullOr(Schema.String)
})
export type ServerInfo = typeof ServerInfo.Type

export const CreateRepository = Schema.Struct({
	name: Schema.String,
	description: Schema.String,
	defaultBranchName: Schema.String
})
export type CreateRepository = typeof CreateRepository.Type

export const CreateBranch = Schema.Struct({
	name: Schema.String,
	fromBranchId: Schema.String,
	fromSignature: Schema.optional(Schema.String),
	category: Schema.optional(Schema.String)
})
export type CreateBranch = typeof CreateBranch.Type

export const Role = Schema.Literals(["admin", "member", "viewer"])
export type Role = typeof Role.Type

export const User = Schema.Struct({
	id: Schema.Number,
	username: Schema.String,
	role: Role,
	mustChangePassword: Schema.Boolean,
	disabled: Schema.Boolean,
	created: Schema.Number
})
export type User = typeof User.Type

export const AuthStatus = Schema.Struct({
	mode: Schema.Literals(["accounts", "off"]),
	setupRequired: Schema.Boolean,
	user: Schema.NullOr(User)
})
export type AuthStatus = typeof AuthStatus.Type

export const SetupRequest = Schema.Struct({
	code: Schema.String,
	username: Schema.String,
	password: Schema.String
})

export const LoginRequest = Schema.Struct({
	username: Schema.String,
	password: Schema.String
})

export const PasswordChange = Schema.Struct({
	current: Schema.String,
	next: Schema.String
})

export const NewUser = Schema.Struct({
	username: Schema.String,
	password: Schema.String,
	role: Role
})
export type NewUser = typeof NewUser.Type

export const UserUpdate = Schema.Struct({
	role: Schema.optional(Role),
	disabled: Schema.optional(Schema.Boolean)
})
export type UserUpdate = typeof UserUpdate.Type

export const PasswordReset = Schema.Struct({
	password: Schema.String
})
