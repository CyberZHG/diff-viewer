#ifndef DIFF_VIEW_VIEW_MODEL_H
#define DIFF_VIEW_VIEW_MODEL_H

#include <cstdint>
#include <string>
#include <vector>

namespace diff_view {

enum class LineKind : uint8_t {
    Blank = 0,
    Context = 1,
    Removed = 2,
    Added = 3,
};

struct SideInfo {
    LineKind kind = LineKind::Blank;
    uint32_t line_no = 0;
};

struct ViewLine {
    SideInfo left;
    SideInfo right;
};

struct InlineHighlight {
    uint32_t row;
    uint32_t start;
    uint32_t end;
    bool is_left;
};

struct Connector {
    uint32_t top;
    uint32_t bottom;
    uint32_t left_start;  // 1-based, 0 = none
    uint32_t left_end;
    uint32_t right_start;
    uint32_t right_end;
};

struct ViewModel {
    std::vector<std::string> old_lines;
    std::vector<std::string> new_lines;
    std::vector<ViewLine> lines;
    std::vector<InlineHighlight> highlights;
    std::vector<Connector> connectors;
};

/**
 * Build a view model from two texts.
 *
 * @param old_text Original text
 * @param new_text New text
 * @param context Number of context lines around changes (default: 3)
 * @return ViewModel ready for UI rendering
 */
ViewModel create_view_model(const std::string& old_text, const std::string& new_text, uint32_t context = 3);

} // namespace diff_view

#endif //DIFF_VIEW_VIEW_MODEL_H
