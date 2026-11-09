import type { DiffLine, FileDiff, Hunk } from "@lore-webui/api"
import { structuredPatch } from "diff"

const BINARY_SNIFF_BYTES = 8000

const decoder = new TextDecoder("utf-8", { fatal: true })

const decode = (bytes: Uint8Array): string | undefined => {
	if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return undefined
	try {
		return decoder.decode(bytes)
	} catch {
		return undefined
	}
}

export const binaryDiff: FileDiff = { binary: true, tooLarge: false, added: 0, deleted: 0, hunks: [] }

export const tooLargeDiff: FileDiff = { binary: false, tooLarge: true, added: 0, deleted: 0, hunks: [] }

export const textDiff = (before: Uint8Array, after: Uint8Array, context = 3): FileDiff => {
	const oldText = decode(before)
	const newText = decode(after)
	if (oldText === undefined || newText === undefined) return binaryDiff
	const patch = structuredPatch("a", "b", oldText, newText, undefined, undefined, { context })
	let added = 0
	let deleted = 0
	const hunks = patch.hunks.map((h): Hunk => {
		let oldNo = h.oldStart
		let newNo = h.newStart
		const lines: Array<DiffLine> = []
		for (const line of h.lines) {
			const marker = line[0]
			const text = line.slice(1)
			if (marker === "+") {
				added++
				lines.push({ kind: "add", text, oldNo: null, newNo: newNo++ })
			} else if (marker === "-") {
				deleted++
				lines.push({ kind: "del", text, oldNo: oldNo++, newNo: null })
			} else if (marker === " ") {
				lines.push({ kind: "context", text, oldNo: oldNo++, newNo: newNo++ })
			}
		}
		return { oldStart: h.oldStart, oldLines: h.oldLines, newStart: h.newStart, newLines: h.newLines, lines }
	})
	return { binary: false, tooLarge: false, added, deleted, hunks }
}
