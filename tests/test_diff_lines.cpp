#include <gtest/gtest.h>
#include "diff.h"

using namespace diff_view;

TEST(DiffLines, BothEmpty) {
    const auto [old_lines, new_lines, hunks] = diff_lines("", "");
    EXPECT_TRUE(old_lines.empty());
    EXPECT_TRUE(new_lines.empty());
    EXPECT_TRUE(hunks.empty());
}

TEST(DiffLines, OldEmpty) {
    const auto [old_lines, new_lines, hunks] = diff_lines("", "line1\nline2");
    EXPECT_TRUE(old_lines.empty());
    ASSERT_EQ(new_lines.size(), 2);
    ASSERT_EQ(hunks.size(), 1);
    EXPECT_EQ(hunks[0].old_count, 0);
    EXPECT_EQ(hunks[0].new_count, 2);
}

TEST(DiffLines, NewEmpty) {
    const auto [old_lines, new_lines, hunks] = diff_lines("line1\nline2", "");
    ASSERT_EQ(old_lines.size(), 2);
    EXPECT_TRUE(new_lines.empty());
    ASSERT_EQ(hunks.size(), 1);
    EXPECT_EQ(hunks[0].old_count, 2);
    EXPECT_EQ(hunks[0].new_count, 0);
}

TEST(DiffLines, Identical) {
    const auto result = diff_lines("line1\nline2\nline3", "line1\nline2\nline3");
    EXPECT_TRUE(result.hunks.empty());
}

TEST(DiffLines, SingleInsert) {
    const auto result = diff_lines("line1\nline3", "line1\nline2\nline3");
    ASSERT_EQ(result.hunks.size(), 1);

    const auto& hunk = result.hunks[0];
    bool has_insert = false;
    for (const auto& line : hunk.lines) {
        if (line.op == DiffOp::Insert) {
            has_insert = true;
            EXPECT_EQ(result.new_lines[line.new_index], "line2");
        }
    }
    EXPECT_TRUE(has_insert);
}

TEST(DiffLines, SingleDelete) {
    const auto result = diff_lines("line1\nline2\nline3", "line1\nline3");
    ASSERT_EQ(result.hunks.size(), 1);

    const auto& hunk = result.hunks[0];
    bool has_delete = false;
    for (const auto& line : hunk.lines) {
        if (line.op == DiffOp::Delete) {
            has_delete = true;
            EXPECT_EQ(result.old_lines[line.old_index], "line2");
        }
    }
    EXPECT_TRUE(has_delete);
}

TEST(DiffLines, Modification) {
    const auto [old_lines, new_lines, hunks] = diff_lines("line1\nold\nline3", "line1\nnew\nline3");
    ASSERT_EQ(hunks.size(), 1);

    const auto& hunk = hunks[0];
    bool has_delete = false, has_insert = false;
    for (const auto&[op, old_index, new_index] : hunk.lines) {
        if (op == DiffOp::Delete) {
            has_delete = true;
            EXPECT_EQ(old_lines[old_index], "old");
        }
        if (op == DiffOp::Insert) {
            has_insert = true;
            EXPECT_EQ(new_lines[new_index], "new");
        }
    }
    EXPECT_TRUE(has_delete);
    EXPECT_TRUE(has_insert);
}

TEST(DiffLines, ContextLines) {
    const auto result = diff_lines(
        "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
        "1\n2\n3\n4\nX\n6\n7\n8\n9\n10",
        3);

    ASSERT_EQ(result.hunks.size(), 1);
    EXPECT_GE(result.hunks[0].lines.size(), 5);
}

TEST(DiffLines, HunkMerging) {
    const auto result = diff_lines(
        "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
        "1\nA\n3\n4\n5\nB\n7\n8\n9\n10",
        2);
    EXPECT_EQ(result.hunks.size(), 1);
}

TEST(DiffLines, HunkNotMerging) {
    const auto result = diff_lines(
        "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20",
        "1\nA\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\nB\n20",
        2);
    EXPECT_EQ(result.hunks.size(), 2);
}

TEST(DiffLines, ZeroContext) {
    const auto result = diff_lines("1\n2\n3", "1\nX\n3", 0);
    ASSERT_EQ(result.hunks.size(), 1);
    size_t change_count = 0;
    for (const auto& line : result.hunks[0].lines) {
        if (line.op != DiffOp::Equal) {
            ++change_count;
        }
    }
    EXPECT_EQ(change_count, 2);
}

TEST(DiffLines, MixedLineEndings) {
    const auto result = diff_lines("a\r\nb\rc", "a\nb\nc");
    EXPECT_TRUE(result.hunks.empty());
}

TEST(DiffLines, UTF8Content) {
    const auto [old_lines, new_lines, hunks] = diff_lines("你好\n世界", "你好\n宇宙");
    ASSERT_EQ(hunks.size(), 1);

    bool found_delete = false, found_insert = false;
    for (const auto&[op, old_index, new_index] : hunks[0].lines) {
        if (op == DiffOp::Delete) {
            EXPECT_EQ(old_lines[old_index], "世界");
            found_delete = true;
        }
        if (op == DiffOp::Insert) {
            EXPECT_EQ(new_lines[new_index], "宇宙");
            found_insert = true;
        }
    }
    EXPECT_TRUE(found_delete);
    EXPECT_TRUE(found_insert);
}

TEST(DiffLines, HunkStartAndCount) {
    const auto result = diff_lines(
        "0\n1\n2\n3\n4",
        "0\n1\nX\n3\n4",
        1);

    ASSERT_EQ(result.hunks.size(), 1);
    const auto& hunk = result.hunks[0];

    EXPECT_EQ(hunk.old_start, 1);
    EXPECT_EQ(hunk.new_start, 1);
}

TEST(DiffLines, MultipleDeletes) {
    const auto result = diff_lines("a\nb\nc\nd", "a\nd", 0);
    ASSERT_EQ(result.hunks.size(), 1);

    size_t delete_count = 0;
    for (const auto& line : result.hunks[0].lines) {
        if (line.op == DiffOp::Delete) {
            ++delete_count;
        }
    }
    EXPECT_EQ(delete_count, 2);
}

TEST(DiffLines, MultipleInserts) {
    const auto result = diff_lines("a\nd", "a\nb\nc\nd", 0);
    ASSERT_EQ(result.hunks.size(), 1);

    size_t insert_count = 0;
    for (const auto& line : result.hunks[0].lines) {
        if (line.op == DiffOp::Insert) {
            ++insert_count;
        }
    }
    EXPECT_EQ(insert_count, 2);
}

TEST(DiffLines, VectorOverload) {
    std::vector<std::string> old_lines = {"a", "b", "c"};
    std::vector<std::string> new_lines = {"a", "x", "c"};

    const auto result = diff_lines(std::move(old_lines), std::move(new_lines), 1);
    ASSERT_EQ(result.hunks.size(), 1);
}

TEST(DiffLines, AllDifferent) {
    const auto result = diff_lines("a\nb\nc", "x\ny\nz", 0);
    ASSERT_EQ(result.hunks.size(), 1);

    size_t delete_count = 0, insert_count = 0;
    for (const auto& line : result.hunks[0].lines) {
        if (line.op == DiffOp::Delete) ++delete_count;
        if (line.op == DiffOp::Insert) ++insert_count;
    }
    EXPECT_EQ(delete_count, 3);
    EXPECT_EQ(insert_count, 3);
}

TEST(DiffLines, SingleLineFiles) {
    const auto result = diff_lines("old", "new", 0);
    ASSERT_EQ(result.hunks.size(), 1);
    EXPECT_EQ(result.hunks[0].old_count, 1);
    EXPECT_EQ(result.hunks[0].new_count, 1);
}

TEST(DiffLines, ChangeAtStart) {
    const auto result = diff_lines("a\nb\nc", "x\nb\nc", 1);
    ASSERT_EQ(result.hunks.size(), 1);
    EXPECT_EQ(result.hunks[0].old_start, 0);
    EXPECT_EQ(result.hunks[0].new_start, 0);
}

TEST(DiffLines, ChangeAtEnd) {
    const auto result = diff_lines("a\nb\nc", "a\nb\nx", 1);
    ASSERT_EQ(result.hunks.size(), 1);
}

TEST(DiffLines, OnlyInserts) {
    const auto result = diff_lines("", "a\nb\nc", 0);
    ASSERT_EQ(result.hunks.size(), 1);
    EXPECT_EQ(result.hunks[0].old_count, 0);
    EXPECT_EQ(result.hunks[0].new_count, 3);
}

TEST(DiffLines, OnlyDeletes) {
    const auto result = diff_lines("a\nb\nc", "", 0);
    ASSERT_EQ(result.hunks.size(), 1);
    EXPECT_EQ(result.hunks[0].old_count, 3);
    EXPECT_EQ(result.hunks[0].new_count, 0);
}
