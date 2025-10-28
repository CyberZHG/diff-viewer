#include "view_model.h"
#include "diff.h"
#include "string_utils.h"

#include <set>
#include <grapheme_break.h>

namespace diff_view {

namespace {

size_t grapheme_to_byte_offset(const std::vector<std::string>& graphemes, const size_t grapheme_idx) {
    size_t offset = 0;
    for (size_t i = 0; i < grapheme_idx && i < graphemes.size(); ++i) {
        offset += graphemes[i].size();
    }
    return offset;
}

} // namespace

ViewModel create_view_model(const std::string& old_text, const std::string& new_text, uint32_t context) {
    ViewModel vm;
    vm.old_lines = split_lines(old_text);
    vm.new_lines = split_lines(new_text);
    auto diff_result = diff_lines(old_text, new_text, context);
    if (diff_result.hunks.empty()) {
        size_t max_lines = std::max(vm.old_lines.size(), vm.new_lines.size());
        for (size_t i = 0; i < max_lines; ++i) {
            ViewLine vl;
            if (i < vm.old_lines.size()) {
                vl.left = {LineKind::Context, static_cast<uint32_t>(i + 1)};
            }
            if (i < vm.new_lines.size()) {
                vl.right = {LineKind::Context, static_cast<uint32_t>(i + 1)};
            }
            vm.lines.push_back(vl);
        }
        return vm;
    }

    size_t old_pos = 0, new_pos = 0;
    for (const auto& hunk : diff_result.hunks) {
        while (old_pos < hunk.old_start && new_pos < hunk.new_start) {
            vm.lines.push_back({
                {LineKind::Context, static_cast<uint32_t>(old_pos + 1)},
                {LineKind::Context, static_cast<uint32_t>(new_pos + 1)}
            });
            ++old_pos;
            ++new_pos;
        }
        auto connector_top = static_cast<uint32_t>(vm.lines.size());
        uint32_t left_start = 0, left_end = 0, right_start = 0, right_end = 0;
        std::vector<size_t> delete_indices, insert_indices;
        for (const auto& [op, old_index, new_index] : hunk.lines) {
            if (op == DiffOp::Delete) {
                delete_indices.push_back(old_index);
            } else if (op == DiffOp::Insert) {
                insert_indices.push_back(new_index);
            }
        }
        std::set<size_t> paired_inserts;
        size_t pair_count = std::min(delete_indices.size(), insert_indices.size());
        for (size_t i = 0; i < pair_count; ++i) {
            paired_inserts.insert(insert_indices[i]);
        }
        size_t del_i = 0;
        for (const auto& [op, old_index, new_index] : hunk.lines) {
            if (op == DiffOp::Equal) {
                vm.lines.push_back({
                    {LineKind::Context, static_cast<uint32_t>(old_index + 1)},
                    {LineKind::Context, static_cast<uint32_t>(new_index + 1)}
                });
                old_pos = old_index + 1;
                new_pos = new_index + 1;
            } else if (op == DiffOp::Delete) {
                auto row_idx = static_cast<uint32_t>(vm.lines.size());
                auto line_no = static_cast<uint32_t>(old_index + 1);
                if (left_start == 0) left_start = line_no;
                left_end = line_no;
                if (del_i < insert_indices.size()) {
                    size_t ins_idx = insert_indices[del_i];
                    auto [old_segments, new_segments] = diff_chars(vm.old_lines[old_index], vm.new_lines[ins_idx]);
                    auto old_graphemes = grapheme_break::segmentGraphemeClusters(vm.old_lines[old_index]);
                    auto new_graphemes = grapheme_break::segmentGraphemeClusters(vm.new_lines[ins_idx]);
                    size_t grapheme_pos = 0;
                    for (const auto& [seg_op, text] : old_segments) {
                        size_t seg_len = grapheme_break::segmentGraphemeClusters(text).size();
                        if (seg_op == DiffOp::Delete) {
                            vm.highlights.push_back({
                                row_idx,
                                static_cast<uint32_t>(grapheme_to_byte_offset(old_graphemes, grapheme_pos)),
                                static_cast<uint32_t>(grapheme_to_byte_offset(old_graphemes, grapheme_pos + seg_len)),
                                true
                            });
                        }
                        grapheme_pos += seg_len;
                    }
                    vm.lines.push_back({
                        {LineKind::Removed, line_no},
                        {LineKind::Added, static_cast<uint32_t>(ins_idx + 1)}
                    });
                    grapheme_pos = 0;
                    for (const auto& [seg_op, text] : new_segments) {
                        size_t seg_len = grapheme_break::segmentGraphemeClusters(text).size();
                        if (seg_op == DiffOp::Insert) {
                            vm.highlights.push_back({
                                row_idx,
                                static_cast<uint32_t>(grapheme_to_byte_offset(new_graphemes, grapheme_pos)),
                                static_cast<uint32_t>(grapheme_to_byte_offset(new_graphemes, grapheme_pos + seg_len)),
                                false
                            });
                        }
                        grapheme_pos += seg_len;
                    }
                    if (right_start == 0) {
                        right_start = static_cast<uint32_t>(ins_idx + 1);
                    }
                    right_end = static_cast<uint32_t>(ins_idx + 1);
                    ++del_i;
                } else {
                    vm.lines.push_back({
                        {LineKind::Removed, line_no},
                        {LineKind::Blank, 0}
                    });
                }
                old_pos = old_index + 1;
            } else if (op == DiffOp::Insert) {
                if (paired_inserts.contains(new_index)) {
                    continue;
                }
                auto line_no = static_cast<uint32_t>(new_index + 1);
                if (right_start == 0) {
                    right_start = line_no;
                }
                right_end = line_no;
                vm.lines.push_back({
                    {LineKind::Blank, 0},
                    {LineKind::Added, line_no}
                });
                new_pos = new_index + 1;
            }
        }
        if (auto connector_bottom = static_cast<uint32_t>(vm.lines.size() - 1); connector_bottom >= connector_top) {
            vm.connectors.push_back({
                connector_top, connector_bottom,
                left_start, left_end,
                right_start, right_end
            });
        }
    }
    while (old_pos < vm.old_lines.size() && new_pos < vm.new_lines.size()) {
        vm.lines.push_back({
            {LineKind::Context, static_cast<uint32_t>(old_pos + 1)},
            {LineKind::Context, static_cast<uint32_t>(new_pos + 1)}
        });
        ++old_pos;
        ++new_pos;
    }
    return vm;
}

} // namespace diff_view
