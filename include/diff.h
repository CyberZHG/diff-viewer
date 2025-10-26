#ifndef DIFF_VIEW_DIFF_H
#define DIFF_VIEW_DIFF_H

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace diff_view {

enum class DiffOp : uint8_t {
    Equal,
    Delete,
    Insert,
};

struct DiffLine {
    DiffOp op;
    size_t old_index;
    size_t new_index;
};

/**
 * A contiguous block of changes with optional context lines.
 *
 * Lines are ordered: context (Equal) -> deletions -> insertions -> context.
 * Adjacent Delete/Insert pairs represent modified lines (for char-level diff).
 */
struct DiffHunk {
    size_t old_start;
    size_t old_count;
    size_t new_start;
    size_t new_count;
    std::vector<DiffLine> lines;
};

struct DiffResult {
    std::vector<std::string> old_lines;
    std::vector<std::string> new_lines;
    std::vector<DiffHunk> hunks;
};

/**
 * Compute line-level diff between two texts using Myers algorithm.
 *
 * @param old_text The original text.
 * @param new_text The new text.
 * @param context_lines Number of context lines around changes (default: 3).
 * @return DiffResult containing hunks and line data.
 */
DiffResult diff_lines(std::string_view old_text, std::string_view new_text, size_t context_lines = 3);

/**
 * Compute line-level diff between two pre-split line vectors.
 *
 * @param old_lines Lines from old text.
 * @param new_lines Lines from new text.
 * @param context_lines Number of context lines around changes (default: 3).
 * @return DiffResult containing hunks.
 */
DiffResult diff_lines(std::vector<std::string> old_lines, std::vector<std::string> new_lines, size_t context_lines = 3);

} // namespace diff_view

#endif //DIFF_VIEW_DIFF_H
