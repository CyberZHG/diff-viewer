#include <gtest/gtest.h>
#include "string_utils.h"

using namespace diff_view;

TEST(SplitLines, EmptyString) {
    const auto lines = split_lines("");
    EXPECT_TRUE(lines.empty());
}

TEST(SplitLines, NoLineEnding) {
    const auto lines = split_lines("hello world");
    ASSERT_EQ(lines.size(), 1);
    EXPECT_EQ(lines[0], "hello world");
}

TEST(SplitLines, LF) {
    const auto lines = split_lines("line1\nline2\nline3");
    ASSERT_EQ(lines.size(), 3);
    EXPECT_EQ(lines[0], "line1");
    EXPECT_EQ(lines[1], "line2");
    EXPECT_EQ(lines[2], "line3");
}

TEST(SplitLines, CR) {
    const auto lines = split_lines("line1\rline2\rline3");
    ASSERT_EQ(lines.size(), 3);
    EXPECT_EQ(lines[0], "line1");
    EXPECT_EQ(lines[1], "line2");
    EXPECT_EQ(lines[2], "line3");
}

TEST(SplitLines, CRLF) {
    const auto lines = split_lines("line1\r\nline2\r\nline3");
    ASSERT_EQ(lines.size(), 3);
    EXPECT_EQ(lines[0], "line1");
    EXPECT_EQ(lines[1], "line2");
    EXPECT_EQ(lines[2], "line3");
}

TEST(SplitLines, TrailingLF) {
    const auto lines = split_lines("line1\nline2\n");
    ASSERT_EQ(lines.size(), 3);
    EXPECT_EQ(lines[0], "line1");
    EXPECT_EQ(lines[1], "line2");
    EXPECT_EQ(lines[2], "");
}

TEST(SplitLines, TrailingCR) {
    const auto lines = split_lines("line1\rline2\r");
    ASSERT_EQ(lines.size(), 3);
    EXPECT_EQ(lines[0], "line1");
    EXPECT_EQ(lines[1], "line2");
    EXPECT_EQ(lines[2], "");
}

TEST(SplitLines, TrailingCRLF) {
    const auto lines = split_lines("line1\r\nline2\r\n");
    ASSERT_EQ(lines.size(), 3);
    EXPECT_EQ(lines[0], "line1");
    EXPECT_EQ(lines[1], "line2");
    EXPECT_EQ(lines[2], "");
}

TEST(SplitLines, MixedLineEndings) {
    const auto lines = split_lines("unix\nwindows\r\nmac\rend");
    ASSERT_EQ(lines.size(), 4);
    EXPECT_EQ(lines[0], "unix");
    EXPECT_EQ(lines[1], "windows");
    EXPECT_EQ(lines[2], "mac");
    EXPECT_EQ(lines[3], "end");
}

TEST(SplitLines, EmptyLines) {
    const auto lines = split_lines("\n\n\n");
    ASSERT_EQ(lines.size(), 4);
    EXPECT_EQ(lines[0], "");
    EXPECT_EQ(lines[1], "");
    EXPECT_EQ(lines[2], "");
    EXPECT_EQ(lines[3], "");
}

TEST(SplitLines, UTF8Content) {
    const auto lines = split_lines("你好\n世界\r\n🎉");
    ASSERT_EQ(lines.size(), 3);
    EXPECT_EQ(lines[0], "你好");
    EXPECT_EQ(lines[1], "世界");
    EXPECT_EQ(lines[2], "🎉");
}

TEST(HashString, EmptyString) {
    const auto h = hash_string("");
    EXPECT_NE(h, 0);
}

TEST(HashString, BasicString) {
    const auto h = hash_string("hello");
    EXPECT_NE(h, 0);
}

TEST(HashString, Deterministic) {
    EXPECT_EQ(hash_string("test"), hash_string("test"));
    EXPECT_EQ(hash_string("hello world"), hash_string("hello world"));
}

TEST(HashString, DifferentStrings) {
    EXPECT_NE(hash_string("hello"), hash_string("world"));
    EXPECT_NE(hash_string("abc"), hash_string("abd"));
}

TEST(HashString, WithSeed) {
    constexpr uint64_t seed = 12345;
    const auto h1 = hash_string("test", seed);
    const auto h2 = hash_string("test", seed);
    EXPECT_EQ(h1, h2);
}

TEST(HashString, DifferentSeeds) {
    const auto h1 = hash_string("test", 100);
    const auto h2 = hash_string("test", 200);
    EXPECT_NE(h1, h2);
}

TEST(HashString, UTF8Content) {
    const auto h1 = hash_string("你好世界");
    const auto h2 = hash_string("你好世界");
    EXPECT_EQ(h1, h2);
    EXPECT_NE(hash_string("你好"), hash_string("世界"));
}
