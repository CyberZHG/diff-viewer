#ifndef DIFF_VIEW_STRING_UTILS_H
#define DIFF_VIEW_STRING_UTILS_H

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace diff_view {

/**
 * Split a string by line endings.
 *
 * @param str The UTF-8 string to split.
 * @return A vector of lines without line ending characters.
 */
std::vector<std::string> split_lines(std::string_view str);

/**
 * Compute FNV-1a hash of a string.
 *
 * @param str The string to hash.
 * @param seed Initial hash value (default: FNV offset basis).
 * @return 64-bit hash value.
 */
uint64_t hash_string(std::string_view str, uint64_t seed = 14695981039346656037ULL);

} // namespace diff_view

#endif //DIFF_VIEW_STRING_UTILS_H
