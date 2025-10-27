#include <gtest/gtest.h>
#include "diff.h"

using namespace diff_view;

TEST(DiffChars, BothEmpty) {
    const auto [old_segments, new_segments] = diff_chars("", "");
    EXPECT_TRUE(old_segments.empty());
    EXPECT_TRUE(new_segments.empty());
}

TEST(DiffChars, Identical) {
    const auto [old_segments, new_segments] = diff_chars("hello", "hello");
    ASSERT_EQ(old_segments.size(), 1);
    ASSERT_EQ(new_segments.size(), 1);
    EXPECT_EQ(old_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(old_segments[0].text, "hello");
    EXPECT_EQ(new_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(new_segments[0].text, "hello");
}

TEST(DiffChars, OldEmpty) {
    const auto [old_segments, new_segments] = diff_chars("", "abc");
    EXPECT_TRUE(old_segments.empty());
    ASSERT_EQ(new_segments.size(), 1);
    EXPECT_EQ(new_segments[0].op, DiffOp::Insert);
    EXPECT_EQ(new_segments[0].text, "abc");
}

TEST(DiffChars, NewEmpty) {
    const auto [old_segments, new_segments] = diff_chars("abc", "");
    ASSERT_EQ(old_segments.size(), 1);
    EXPECT_EQ(old_segments[0].op, DiffOp::Delete);
    EXPECT_EQ(old_segments[0].text, "abc");
    EXPECT_TRUE(new_segments.empty());
}

TEST(DiffChars, SingleCharChange) {
    const auto [old_segments, new_segments] = diff_chars("abc", "axc");
    ASSERT_EQ(old_segments.size(), 3);
    ASSERT_EQ(new_segments.size(), 3);

    EXPECT_EQ(old_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(old_segments[0].text, "a");
    EXPECT_EQ(old_segments[1].op, DiffOp::Delete);
    EXPECT_EQ(old_segments[1].text, "b");
    EXPECT_EQ(old_segments[2].op, DiffOp::Equal);
    EXPECT_EQ(old_segments[2].text, "c");

    EXPECT_EQ(new_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(new_segments[0].text, "a");
    EXPECT_EQ(new_segments[1].op, DiffOp::Insert);
    EXPECT_EQ(new_segments[1].text, "x");
    EXPECT_EQ(new_segments[2].op, DiffOp::Equal);
    EXPECT_EQ(new_segments[2].text, "c");
}

TEST(DiffChars, InsertInMiddle) {
    const auto [old_segments, new_segments] = diff_chars("ac", "abc");

    ASSERT_EQ(old_segments.size(), 1);
    EXPECT_EQ(old_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(old_segments[0].text, "ac");

    ASSERT_EQ(new_segments.size(), 3);
    EXPECT_EQ(new_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(new_segments[0].text, "a");
    EXPECT_EQ(new_segments[1].op, DiffOp::Insert);
    EXPECT_EQ(new_segments[1].text, "b");
    EXPECT_EQ(new_segments[2].op, DiffOp::Equal);
    EXPECT_EQ(new_segments[2].text, "c");
}

TEST(DiffChars, DeleteFromMiddle) {
    const auto [old_segments, new_segments] = diff_chars("abc", "ac");

    ASSERT_EQ(old_segments.size(), 3);
    EXPECT_EQ(old_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(old_segments[0].text, "a");
    EXPECT_EQ(old_segments[1].op, DiffOp::Delete);
    EXPECT_EQ(old_segments[1].text, "b");
    EXPECT_EQ(old_segments[2].op, DiffOp::Equal);
    EXPECT_EQ(old_segments[2].text, "c");

    ASSERT_EQ(new_segments.size(), 1);
    EXPECT_EQ(new_segments[0].op, DiffOp::Equal);
    EXPECT_EQ(new_segments[0].text, "ac");
}

TEST(DiffChars, UTF8Chinese) {
    const auto [old_segments, new_segments] = diff_chars("你好世界", "你好宇宙");
    bool has_equal = false, has_delete = false, has_insert = false;
    for (const auto&[op, text] : old_segments) {
        if (op == DiffOp::Equal) has_equal = true;
        if (op == DiffOp::Delete) {
            has_delete = true;
            EXPECT_EQ(text, "世界");
        }
    }
    for (const auto&[op, text] : new_segments) {
        if (op == DiffOp::Insert) {
            has_insert = true;
            EXPECT_EQ(text, "宇宙");
        }
    }
    EXPECT_TRUE(has_equal);
    EXPECT_TRUE(has_delete);
    EXPECT_TRUE(has_insert);
}

TEST(DiffChars, Emoji) {
    const auto [old_segments, new_segments] = diff_chars("a😀b", "a😎b");
    bool found_emoji_delete = false, found_emoji_insert = false;
    for (const auto&[op, text] : old_segments) {
        if (op == DiffOp::Delete && text == "😀") {
            found_emoji_delete = true;
        }
    }
    for (const auto&[op, text] : new_segments) {
        if (op == DiffOp::Insert && text == "😎") {
            found_emoji_insert = true;
        }
    }
    EXPECT_TRUE(found_emoji_delete);
    EXPECT_TRUE(found_emoji_insert);
}

TEST(DiffChars, EmojiWithSkinTone) {
    const auto [old_segments, new_segments] = diff_chars("👋🏻", "👋🏿");
    ASSERT_EQ(old_segments.size(), 1);
    EXPECT_EQ(old_segments[0].op, DiffOp::Delete);
    ASSERT_EQ(new_segments.size(), 1);
    EXPECT_EQ(new_segments[0].op, DiffOp::Insert);
}

TEST(DiffChars, ConsecutiveChanges) {
    const auto [old_segments, new_segments] = diff_chars("abcd", "xyzd");
    bool has_delete = false, has_insert = false;
    for (const auto&[op, text] : old_segments) {
        if (op == DiffOp::Delete) {
            has_delete = true;
            EXPECT_EQ(text, "abc");
        }
    }
    for (const auto&[op, text] : new_segments) {
        if (op == DiffOp::Insert) {
            has_insert = true;
            EXPECT_EQ(text, "xyz");
        }
    }
    EXPECT_TRUE(has_delete);
    EXPECT_TRUE(has_insert);
}

TEST(DiffChars, AllDifferent) {
    const auto [old_segments, new_segments] = diff_chars("abc", "xyz");
    ASSERT_EQ(old_segments.size(), 1);
    EXPECT_EQ(old_segments[0].op, DiffOp::Delete);
    EXPECT_EQ(old_segments[0].text, "abc");
    ASSERT_EQ(new_segments.size(), 1);
    EXPECT_EQ(new_segments[0].op, DiffOp::Insert);
    EXPECT_EQ(new_segments[0].text, "xyz");
}

TEST(DiffChars, MixedContent) {
    const auto [old_segments, new_segments] = diff_chars("a你😀", "a我😀");
    bool found_chinese_delete = false, found_chinese_insert = false;
    for (const auto&[op, text] : old_segments) {
        if (op == DiffOp::Delete && text == "你") {
            found_chinese_delete = true;
        }
    }
    for (const auto&[op, text] : new_segments) {
        if (op == DiffOp::Insert && text == "我") {
            found_chinese_insert = true;
        }
    }
    EXPECT_TRUE(found_chinese_delete);
    EXPECT_TRUE(found_chinese_insert);
}
