#include "string_utils.h"

namespace diff_view {

std::vector<std::string> split_lines(const std::string_view str) {
    std::vector<std::string> lines;
    if (str.empty()) {
        return lines;
    }
    size_t start = 0, i = 0;
    while (i < str.size()) {
        if (str[i] == '\r') {
            lines.emplace_back(str.substr(start, i - start));
            if (i + 1 < str.size() && str[i + 1] == '\n') {
                i += 2;
            } else {
                i += 1;
            }
            start = i;
        } else if (str[i] == '\n') {
            lines.emplace_back(str.substr(start, i - start));
            i += 1;
            start = i;
        } else {
            i += 1;
        }
    }
    if (start <= str.size()) {
        lines.emplace_back(str.substr(start));
    }
    return lines;
}

uint64_t hash_string(const std::string_view str, const uint64_t seed) {
    static constexpr uint64_t FNV_PRIME = 1099511628211ULL;
    uint64_t hash = seed;
    for (const auto c : str) {
        hash ^= c;
        hash *= FNV_PRIME;
    }
    return hash;
}

} // namespace diff_view
