#include "view_model.h"
#include <emscripten/bind.h>

using namespace emscripten;
using namespace diff_view;

EMSCRIPTEN_BINDINGS(DiffViewWASM) {
    enum_<LineKind>("LineKind")
        .value("Blank", LineKind::Blank)
        .value("Context", LineKind::Context)
        .value("Removed", LineKind::Removed)
        .value("Added", LineKind::Added);

    value_object<SideInfo>("SideInfo")
        .field("kind", &SideInfo::kind)
        .field("lineNo", &SideInfo::line_no);

    value_object<ViewLine>("ViewLine")
        .field("left", &ViewLine::left)
        .field("right", &ViewLine::right);

    value_object<InlineHighlight>("InlineHighlight")
        .field("row", &InlineHighlight::row)
        .field("start", &InlineHighlight::start)
        .field("end", &InlineHighlight::end)
        .field("isLeft", &InlineHighlight::is_left);

    value_object<Connector>("Connector")
        .field("top", &Connector::top)
        .field("bottom", &Connector::bottom)
        .field("leftStart", &Connector::left_start)
        .field("leftEnd", &Connector::left_end)
        .field("rightStart", &Connector::right_start)
        .field("rightEnd", &Connector::right_end);

    register_vector<std::string>("VectorString");
    register_vector<ViewLine>("VectorViewLine");
    register_vector<InlineHighlight>("VectorInlineHighlight");
    register_vector<Connector>("VectorConnector");

    value_object<ViewModel>("ViewModel")
        .field("oldLines", &ViewModel::old_lines)
        .field("newLines", &ViewModel::new_lines)
        .field("lines", &ViewModel::lines)
        .field("highlights", &ViewModel::highlights)
        .field("connectors", &ViewModel::connectors);

    function("createViewModel", &create_view_model);
}
