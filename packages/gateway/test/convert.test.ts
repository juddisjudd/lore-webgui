import { create } from "@bufbuild/protobuf"
import { timestampFromMs } from "@bufbuild/protobuf/wkt"
import { describe, expect, test } from "bun:test"
import { LockSchema } from "../src/gen/lock_pb.ts"
import { EventSchema } from "../src/gen/lore_notification_pb.ts"
import { AddressSchema, BranchSchema } from "../src/gen/lore/model/v1/model_pb.ts"
import { Action, DiffChangeSchema, NodeType, TreeNodeSchema } from "../src/gen/lore/thin_client/v1/model_pb.ts"
import * as convert from "../src/lore/convert.ts"

const fill = (length: number, value: number) => new Uint8Array(length).fill(value)

describe("addresses", () => {
	test("round-trip hash and context through the Lore string form", () => {
		const address = create(AddressSchema, { hash: fill(32, 0xab), context: fill(16, 0x01) })
		const text = convert.addressToString(address)
		expect(text).toBe(`${"ab".repeat(32)}-${"01".repeat(16)}`)
		expect(convert.parseAddress(text!)).toEqual({ hash: fill(32, 0xab), context: fill(16, 0x01) })
	})

	test("treat a missing or zero hash as no content", () => {
		expect(convert.addressToString(undefined)).toBeNull()
		expect(convert.addressToString(create(AddressSchema, { hash: fill(32, 0) }))).toBeNull()
	})

	test("reject malformed address strings", () => {
		expect(convert.parseAddress("zz")).toBeUndefined()
		expect(convert.parseAddress("ab-cd-ef")).toBeUndefined()
	})
})

describe("branch", () => {
	test("maps a zero tip to null and keeps the ancestry stack", () => {
		const branch = convert.branch(
			create(BranchSchema, {
				id: fill(16, 2),
				name: "feature/x",
				latest: fill(32, 0),
				stack: [{ branchId: fill(16, 1), revisionSignature: fill(32, 9) }]
			})
		)
		expect(branch.latest).toBeNull()
		expect(branch.stack).toEqual([{ branchId: "01".repeat(16), signature: "09".repeat(32) }])
	})
})

describe("change", () => {
	const address = (byte: number) => create(AddressSchema, { hash: fill(32, byte), context: fill(16, 1) })

	test("reads KEEP with different content as modified", () => {
		const change = convert.change(
			create(DiffChangeSchema, {
				path: "a.txt",
				action: Action.KEEP,
				nodeType: NodeType.FILE,
				contentFrom: address(1),
				contentTo: address(2)
			})
		)
		expect(change.action).toBe("modified")
	})

	test("reads KEEP with the same content as unchanged", () => {
		const change = convert.change(
			create(DiffChangeSchema, { path: "a.txt", nodeType: NodeType.FILE, contentFrom: address(1), contentTo: address(1) })
		)
		expect(change.action).toBe("unchanged")
	})

	test("drops directory content hashes, which cannot be fetched", () => {
		const change = convert.change(
			create(DiffChangeSchema, { path: "dir", action: Action.ADD, nodeType: NodeType.DIRECTORY, contentTo: address(3) })
		)
		expect(change).toMatchObject({ action: "added", kind: "directory", contentTo: null })
	})
})

describe("tree entries", () => {
	test("derive the name and executable flag", () => {
		const entry = convert.treeEntry(create(TreeNodeSchema, { path: "bin/run.sh", nodeType: NodeType.FILE, mode: 1n, size: 12n }))
		expect(entry).toMatchObject({ name: "run.sh", executable: true, size: 12, kind: "file" })
	})

	test("sort directories first, then names in natural order", () => {
		const entries = ["b10", "b2", "dir"].map((path) =>
			convert.treeEntry(create(TreeNodeSchema, { path, nodeType: path === "dir" ? NodeType.DIRECTORY : NodeType.FILE }))
		)
		expect(entries.sort(convert.compareEntries).map((e) => e.name)).toEqual(["dir", "b2", "b10"])
	})
})

describe("fileLock", () => {
	test("reads the path from the resource description and the time in milliseconds", () => {
		const lock = create(LockSchema, {
			resource: { branch: fill(16, 0x02), hash: fill(32, 0x03), description: "Content/Maps/Arena.umap" },
			owner: "artist@studio",
			lockedAt: timestampFromMs(1_700_000_000_123)
		})
		expect(convert.fileLock(lock)).toEqual({
			path: "Content/Maps/Arena.umap",
			branchId: "02".repeat(16),
			owner: "artist@studio",
			lockedAt: 1_700_000_000_123
		})
	})

	test("drop a lock without a resource", () => {
		expect(convert.fileLock(create(LockSchema, { owner: "nobody" }))).toBeNull()
	})
})

describe("repositoryEvent", () => {
	test("maps a push to the branch, revision and user", () => {
		const event = create(EventSchema, {
			event: {
				case: "branchPushed",
				value: { branch: fill(16, 0x02), revision: fill(32, 0x04), revisionNumber: 7n, userId: "coder" }
			}
		})
		expect(convert.repositoryEvent(event)).toEqual({
			_tag: "BranchPushed",
			branchId: "02".repeat(16),
			signature: "04".repeat(32),
			number: 7,
			user: "coder"
		})
	})

	test("lists each locked path and each branch once", () => {
		const resource = (path: string) => ({ branch: fill(16, 0x02), hash: fill(32, 0x03), description: path })
		const event = create(EventSchema, {
			event: { case: "resourceUnlocked", value: { userId: "artist", resources: [resource("a.umap"), resource("b.fbx")] } }
		})
		expect(convert.repositoryEvent(event)).toEqual({
			_tag: "FilesUnlocked",
			user: "artist",
			branchIds: ["02".repeat(16)],
			paths: ["a.umap", "b.fbx"]
		})
	})

	test("skip events the web UI does not use", () => {
		expect(convert.repositoryEvent(create(EventSchema, { event: { case: "obliterate", value: {} } }))).toBeNull()
		expect(convert.repositoryEvent(create(EventSchema, {}))).toBeNull()
	})
})
