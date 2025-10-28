#include <gtest/gtest.h>
#include "view_model.h"

using namespace diff_view;

TEST(ViewModel, BothEmpty) {
    const auto vm = create_view_model("", "");
    EXPECT_TRUE(vm.old_lines.empty());
    EXPECT_TRUE(vm.new_lines.empty());
    EXPECT_TRUE(vm.lines.empty());
    EXPECT_TRUE(vm.connectors.empty());
}

TEST(ViewModel, Identical) {
    const auto vm = create_view_model("a\nb\nc", "a\nb\nc");
    ASSERT_EQ(vm.lines.size(), 3);
    for (const auto&[left, right] : vm.lines) {
        EXPECT_EQ(left.kind, LineKind::Context);
        EXPECT_EQ(right.kind, LineKind::Context);
    }
    EXPECT_TRUE(vm.connectors.empty());
}

TEST(ViewModel, SingleInsert) {
    const auto vm = create_view_model("a\nc", "a\nb\nc");
    ASSERT_EQ(vm.connectors.size(), 1);

    bool found_added = false;
    for (const auto&[left, right] : vm.lines) {
        if (right.kind == LineKind::Added) {
            found_added = true;
            EXPECT_EQ(vm.new_lines[right.line_no - 1], "b");
        }
    }
    EXPECT_TRUE(found_added);
}

TEST(ViewModel, SingleDelete) {
    const auto vm = create_view_model("a\nb\nc", "a\nc");
    ASSERT_EQ(vm.connectors.size(), 1);

    bool found_removed = false;
    for (const auto&[left, right] : vm.lines) {
        if (left.kind == LineKind::Removed) {
            found_removed = true;
            EXPECT_EQ(vm.old_lines[left.line_no - 1], "b");
        }
    }
    EXPECT_TRUE(found_removed);
}

TEST(ViewModel, Modification) {
    const auto vm = create_view_model("a\nold\nc", "a\nnew\nc");
    ASSERT_EQ(vm.connectors.size(), 1);

    bool found_pair = false;
    for (const auto&[left, right] : vm.lines) {
        if (left.kind == LineKind::Removed && right.kind == LineKind::Added) {
            found_pair = true;
            EXPECT_EQ(vm.old_lines[left.line_no - 1], "old");
            EXPECT_EQ(vm.new_lines[right.line_no - 1], "new");
        }
    }
    EXPECT_TRUE(found_pair);
}

TEST(ViewModel, InlineHighlights) {
    const auto vm = create_view_model("abc", "axc");
    EXPECT_FALSE(vm.highlights.empty());

    bool has_left = false, has_right = false;
    for (const auto& h : vm.highlights) {
        if (h.is_left) has_left = true;
        else has_right = true;
    }
    EXPECT_TRUE(has_left);
    EXPECT_TRUE(has_right);
}

TEST(ViewModel, ConnectorRange) {
    const auto vm = create_view_model("1\n2\n3\n4\n5", "1\n2\nX\n4\n5", 1);
    ASSERT_EQ(vm.connectors.size(), 1);

    const auto& c = vm.connectors[0];
    EXPECT_LE(c.top, c.bottom);
    EXPECT_GT(c.left_start, 0);
    EXPECT_GT(c.right_start, 0);
}

TEST(ViewModel, MultipleHunks) {
    const auto vm = create_view_model(
        "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15",
        "1\nA\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\nB\n15",
        1);
    EXPECT_EQ(vm.connectors.size(), 2);
}

TEST(ViewModel, OnlyInserts) {
    const auto vm = create_view_model("", "a\nb");
    ASSERT_EQ(vm.connectors.size(), 1);

    for (const auto&[left, right] : vm.lines) {
        EXPECT_EQ(left.kind, LineKind::Blank);
        EXPECT_EQ(right.kind, LineKind::Added);
    }
}

TEST(ViewModel, OnlyDeletes) {
    const auto vm = create_view_model("a\nb", "");
    ASSERT_EQ(vm.connectors.size(), 1);

    for (const auto&[left, right] : vm.lines) {
        EXPECT_EQ(left.kind, LineKind::Removed);
        EXPECT_EQ(right.kind, LineKind::Blank);
    }
}

TEST(ViewModel, UTF8Content) {
    const auto vm = create_view_model("你好", "你坏");
    EXPECT_FALSE(vm.highlights.empty());
    ASSERT_EQ(vm.connectors.size(), 1);
}

TEST(ViewModel, LineNumbers) {
    const auto vm = create_view_model("a\nb\nc", "a\nx\nc");
    for (const auto&[left, right] : vm.lines) {
        if (left.kind != LineKind::Blank) {
            EXPECT_GT(left.line_no, 0);
            EXPECT_LE(left.line_no, vm.old_lines.size());
        }
        if (right.kind != LineKind::Blank) {
            EXPECT_GT(right.line_no, 0);
            EXPECT_LE(right.line_no, vm.new_lines.size());
        }
    }
}

TEST(ViewModel, BlankAlignment) {
    const auto vm = create_view_model("a\nb\nc", "a\nc");
    bool found_blank_right = false;
    for (const auto&[left, right] : vm.lines) {
        if (left.kind == LineKind::Removed && right.kind == LineKind::Blank) {
            found_blank_right = true;
        }
    }
    EXPECT_TRUE(found_blank_right);
}
