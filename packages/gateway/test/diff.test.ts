import { describe, expect, test } from "bun:test"
import { textDiff } from "../src/diff.ts"

const bytes = (text: string) => new TextEncoder().encode(text)

describe("textDiff", () => {
	test("numbers added, removed and context lines", () => {
		const diff = textDiff(bytes("a\nb\nc\n"), bytes("a\nB\nc\nd\n"))
		expect(diff.binary).toBe(false)
		expect(diff.added).toBe(2)
		expect(diff.deleted).toBe(1)
		expect(diff.hunks).toHaveLength(1)
		expect(diff.hunks[0]!.lines).toEqual([
			{ kind: "context", text: "a", oldNo: 1, newNo: 1 },
			{ kind: "del", text: "b", oldNo: 2, newNo: null },
			{ kind: "add", text: "B", oldNo: null, newNo: 2 },
			{ kind: "context", text: "c", oldNo: 3, newNo: 3 },
			{ kind: "add", text: "d", oldNo: null, newNo: 4 }
		])
	})

	test("treats a new file as all additions", () => {
		const diff = textDiff(new Uint8Array(0), bytes("one\ntwo\n"))
		expect(diff.added).toBe(2)
		expect(diff.deleted).toBe(0)
		expect(diff.hunks[0]!.oldLines).toBe(0)
	})

	test("reports identical content as having no hunks", () => {
		expect(textDiff(bytes("same\n"), bytes("same\n")).hunks).toHaveLength(0)
	})

	test("flags content with NUL bytes as binary", () => {
		const diff = textDiff(new Uint8Array([137, 80, 78, 71, 0, 1]), bytes("text"))
		expect(diff).toMatchObject({ binary: true, hunks: [] })
	})

	test("flags invalid UTF-8 as binary", () => {
		expect(textDiff(new Uint8Array([0xff, 0xfe, 0x41]), bytes("A")).binary).toBe(true)
	})
})
