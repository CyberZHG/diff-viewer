#include "diff.h"
#include "string_utils.h"

#include <algorithm>
#include <ranges>
#include <grapheme_break.h>

namespace diff_view {

namespace {

bool lines_equal(const std::string& a, const uint64_t hash_a,
                 const std::string& b, const uint64_t hash_b) {
    return hash_a == hash_b && a == b;
}

std::vector<DiffOp> myers_diff(const std::vector<std::string>& old_lines,
                               const std::vector<std::string>& new_lines,
                               const std::vector<uint64_t>& old_hashes,
                               const std::vector<uint64_t>& new_hashes) {
    const int n = static_cast<int>(old_lines.size());
    const int m = static_cast<int>(new_lines.size());
    const int max_d = n + m;

    if (max_d == 0) {
        return {};
    }

    // V[k] = x: coordinate of the furthest reaching path in diagonal k
    const int offset = max_d;
    std::vector v(2 * max_d + 1, 0);
    std::vector<std::vector<int>> trace;
    bool found = false;
    for (int d = 0; d <= max_d && !found; ++d) {
        trace.push_back(v);
        for (int k = -d; k <= d; k += 2) {
            int x;
            if (k == -d || (k != d && v[k - 1 + offset] < v[k + 1 + offset])) {
                x = v[k + 1 + offset]; // Move down (insert)
            } else {
                x = v[k - 1 + offset] + 1; // Move right (delete)
            }
            int y = x - k;
            while (x < n && y < m && lines_equal(old_lines[x], old_hashes[x], new_lines[y], new_hashes[y])) {
                ++x;
                ++y;
            }
            v[k + offset] = x;
            if (x >= n && y >= m) {
                found = true;
                break;
            }
        }
    }

    std::vector<DiffOp> result;
    int x = n, y = m;
    for (int d = static_cast<int>(trace.size()) - 1; d >= 0 && (x > 0 || y > 0); --d) {
        const auto& v_prev = trace[d];
        const int k = x - y;
        int prev_k;
        if (k == -d || (k != d && v_prev[k - 1 + offset] < v_prev[k + 1 + offset])) {
            prev_k = k + 1; // Came from above (insert)
        } else {
            prev_k = k - 1; // Came from left (delete)
        }
        const int prev_x = v_prev[prev_k + offset];
        const int prev_y = prev_x - prev_k;
        // Add diagonal moves (equal)
        while (x > prev_x && y > prev_y) {
            result.push_back(DiffOp::Equal);
            --x;
            --y;
        }
        if (d > 0) {
            if (x == prev_x) {
                result.push_back(DiffOp::Insert);
                --y;
            } else {
                result.push_back(DiffOp::Delete);
                --x;
            }
        }
    }
    std::ranges::reverse(result);
    return result;
}

std::vector<DiffLine> build_diff_lines(const std::vector<DiffOp>& script) {
    std::vector<DiffLine> lines;
    size_t old_idx = 0;
    size_t new_idx = 0;
    for (const auto op : script) {
        DiffLine line{};
        line.op = op;
        switch (op) {
            case DiffOp::Equal:
                line.old_index = old_idx++;
                line.new_index = new_idx++;
                break;
            case DiffOp::Delete:
                line.old_index = old_idx++;
                line.new_index = SIZE_MAX;
                break;
            case DiffOp::Insert:
                line.old_index = SIZE_MAX;
                line.new_index = new_idx++;
                break;
        }
        lines.push_back(line);
    }

    return lines;
}

/**
 * Find ranges of changes (non-Equal lines).
 * Returns pairs of (start_index, end_index) in the diff_lines array.
 */
std::vector<std::pair<size_t, size_t>> find_change_ranges(const std::vector<DiffLine>& lines) {
    std::vector<std::pair<size_t, size_t>> ranges;
    size_t i = 0;
    while (i < lines.size()) {
        while (i < lines.size() && lines[i].op == DiffOp::Equal) {
            ++i;
        }
        if (i >= lines.size()) {
            break;
        }
        const size_t start = i;
        while (i < lines.size() && lines[i].op != DiffOp::Equal) {
            ++i;
        }
        ranges.emplace_back(start, i);
    }
    return ranges;
}

/**
 * Merge change ranges that are close together (within 2 * context_lines).
 */
std::vector<std::pair<size_t, size_t>> merge_ranges(
    const std::vector<std::pair<size_t, size_t>>& ranges,
    const size_t context_lines) {
    if (ranges.empty()) {
        return {};
    }
    std::vector<std::pair<size_t, size_t>> merged;
    const size_t gap_threshold = 2 * context_lines;
    auto current = ranges[0];
    for (size_t i = 1; i < ranges.size(); ++i) {
        if (const auto& next = ranges[i]; next.first <= current.second + gap_threshold) {
            current.second = next.second;
        } else {
            merged.push_back(current);
            current = next;
        }
    }
    merged.push_back(current);
    return merged;
}

/**
 * Build hunks from merged ranges with context.
 */
std::vector<DiffHunk> build_hunks(
    const std::vector<DiffLine>& all_lines,
    const std::vector<std::pair<size_t, size_t>>& merged_ranges,
    const size_t context_lines) {
    std::vector<DiffHunk> hunks;
    for (const auto& [change_start, change_end] : merged_ranges) {
        DiffHunk hunk{};
        const size_t hunk_start = (change_start > context_lines) ? (change_start - context_lines) : 0;
        const size_t hunk_end = std::min(change_end + context_lines, all_lines.size());
        bool first_old = true, first_new = true;
        size_t old_end = 0, new_end = 0;
        for (size_t i = hunk_start; i < hunk_end; ++i) {
            const auto& line = all_lines[i];
            hunk.lines.push_back(line);
            if (line.op != DiffOp::Insert && line.old_index != SIZE_MAX) {
                if (first_old) {
                    hunk.old_start = line.old_index;
                    first_old = false;
                }
                old_end = line.old_index + 1;
            }
            if (line.op != DiffOp::Delete && line.new_index != SIZE_MAX) {
                if (first_new) {
                    hunk.new_start = line.new_index;
                    first_new = false;
                }
                new_end = line.new_index + 1;
            }
        }
        hunk.old_count = first_old ? 0 : (old_end - hunk.old_start);
        hunk.new_count = first_new ? 0 : (new_end - hunk.new_start);
        hunks.push_back(std::move(hunk));
    }

    return hunks;
}

} // anonymous namespace

DiffResult diff_lines(const std::string_view old_text, const std::string_view new_text, const size_t context_lines) {
    return diff_lines(split_lines(old_text), split_lines(new_text), context_lines);
}

DiffResult diff_lines(std::vector<std::string> old_lines, std::vector<std::string> new_lines, const size_t context_lines) {
    DiffResult result;
    result.old_lines = std::move(old_lines);
    result.new_lines = std::move(new_lines);
    std::vector<uint64_t> old_hashes;
    std::vector<uint64_t> new_hashes;
    old_hashes.reserve(result.old_lines.size());
    new_hashes.reserve(result.new_lines.size());
    for (const auto& line : result.old_lines) {
        old_hashes.push_back(hash_string(line));
    }
    for (const auto& line : result.new_lines) {
        new_hashes.push_back(hash_string(line));
    }
    const auto script = myers_diff(result.old_lines, result.new_lines, old_hashes, new_hashes);
    const auto all_lines = build_diff_lines(script);
    const auto change_ranges = find_change_ranges(all_lines);
    const auto merged_ranges = merge_ranges(change_ranges, context_lines);
    result.hunks = build_hunks(all_lines, merged_ranges, context_lines);
    return result;
}

namespace {

/**
 * Myers diff for grapheme clusters.
 */
std::vector<DiffOp> myers_diff_graphemes(const std::vector<std::string>& old_graphemes,
                                          const std::vector<std::string>& new_graphemes) {
    const int n = static_cast<int>(old_graphemes.size());
    const int m = static_cast<int>(new_graphemes.size());
    const int max_d = n + m;
    if (max_d == 0) {
        return {};
    }
    const int offset = max_d;
    std::vector v(2 * max_d + 1, 0);
    std::vector<std::vector<int>> trace;
    bool found = false;
    for (int d = 0; d <= max_d && !found; ++d) {
        trace.push_back(v);
        for (int k = -d; k <= d; k += 2) {
            int x;
            if (k == -d || (k != d && v[k - 1 + offset] < v[k + 1 + offset])) {
                x = v[k + 1 + offset];
            } else {
                x = v[k - 1 + offset] + 1;
            }
            int y = x - k;
            while (x < n && y < m && old_graphemes[x] == new_graphemes[y]) {
                ++x;
                ++y;
            }
            v[k + offset] = x;
            if (x >= n && y >= m) {
                found = true;
                break;
            }
        }
    }
    std::vector<DiffOp> result;
    int x = n, y = m;
    for (int d = static_cast<int>(trace.size()) - 1; d >= 0 && (x > 0 || y > 0); --d) {
        const auto& v_prev = trace[d];
        const int k = x - y;
        int prev_k;
        if (k == -d || (k != d && v_prev[k - 1 + offset] < v_prev[k + 1 + offset])) {
            prev_k = k + 1;
        } else {
            prev_k = k - 1;
        }
        const int prev_x = v_prev[prev_k + offset];
        const int prev_y = prev_x - prev_k;
        while (x > prev_x && y > prev_y) {
            result.push_back(DiffOp::Equal);
            --x;
            --y;
        }
        if (d > 0) {
            if (x == prev_x) {
                result.push_back(DiffOp::Insert);
                --y;
            } else {
                result.push_back(DiffOp::Delete);
                --x;
            }
        }
    }
    std::ranges::reverse(result);
    return result;
}

void append_to_segments(std::vector<CharDiffSegment>& segments,
                        const DiffOp op, const std::string& text) {
    if (!segments.empty() && segments.back().op == op) {
        segments.back().text += text;
    } else {
        segments.push_back({op, text});
    }
}

} // anonymous namespace

CharDiffResult diff_chars(const std::string_view old_str, const std::string_view new_str) {
    CharDiffResult result;
    const auto old_graphemes = grapheme_break::segmentGraphemeClusters(std::string(old_str));
    const auto new_graphemes = grapheme_break::segmentGraphemeClusters(std::string(new_str));
    const auto script = myers_diff_graphemes(old_graphemes, new_graphemes);
    size_t old_idx = 0;
    size_t new_idx = 0;
    for (const auto op : script) {
        switch (op) {
            case DiffOp::Equal:
                append_to_segments(result.old_segments, DiffOp::Equal, old_graphemes[old_idx]);
                append_to_segments(result.new_segments, DiffOp::Equal, new_graphemes[new_idx]);
                ++old_idx;
                ++new_idx;
                break;
            case DiffOp::Delete:
                append_to_segments(result.old_segments, DiffOp::Delete, old_graphemes[old_idx]);
                ++old_idx;
                break;
            case DiffOp::Insert:
                append_to_segments(result.new_segments, DiffOp::Insert, new_graphemes[new_idx]);
                ++new_idx;
                break;
        }
    }
    return result;
}

} // namespace diff_view
