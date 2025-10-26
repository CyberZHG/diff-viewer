cmake_minimum_required(VERSION 4.0)
project(DiffView)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(DIFF_VIEW_ENABLE_TESTS "Build tests" OFF)
option(DIFF_VIEW_ENABLE_STRICT "Use strict compile options" OFF)
option(DIFF_VIEW_ENABLE_COVERAGE "Enable coverage reporting" OFF)
option(DIFF_VIEW_BIND_ES "Enable ECMAScript binding" OFF)

if(APPLE)
    set(ENV{PKG_CONFIG_PATH} "/opt/homebrew/lib/pkgconfig:$ENV{PKG_CONFIG_PATH}")
endif()

include(FetchContent)

FetchContent_Declare(
        GraphemeClusterBreak
        GIT_REPOSITORY https://github.com/CyberZHG/GraphemeClusterBreak.git
        GIT_TAG v1.1.0
)

FetchContent_MakeAvailable(GraphemeClusterBreak)

if(DIFF_VIEW_ENABLE_STRICT)
    if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
        add_compile_options(
                -Wall
                -Wextra
                -Werror
                -Wpedantic
                -Wmissing-include-dirs
                -Wundef
                -Wredundant-decls
        )
    endif()
endif()

if(DIFF_VIEW_ENABLE_COVERAGE)
    if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
        add_compile_options(--coverage -O0 -g -fno-elide-constructors -fno-default-inline)
        add_link_options(--coverage)
    endif()
endif()

add_library(DiffView STATIC
        include/string_utils.h
        src/string_utils.cpp
        include/diff.h
        src/diff.cpp
)

target_include_directories(DiffView
        PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(DiffView
        PRIVATE GraphemeClusterBreak
)

if(DIFF_VIEW_ENABLE_TESTS)
    enable_testing()

    FetchContent_Declare(
            googletest
            GIT_REPOSITORY https://github.com/google/googletest.git
            GIT_TAG v1.17.0
    )

    FetchContent_MakeAvailable(googletest)

    add_executable(runTests
            tests/main.cpp
            tests/test_string_utils.cpp
            tests/test_diff_lines.cpp
    )

    target_link_libraries(runTests
            PRIVATE DiffView
            PRIVATE gtest gtest_main
    )

    add_test(NAME DiffViewTests COMMAND runTests)
endif()

if(DIFF_VIEW_BIND_ES)

    add_executable(DiffViewWASM
            wasm/binding.cpp)

    target_link_libraries(DiffViewWASM
            PRIVATE DiffView
    )

    target_compile_options(DiffViewWASM PRIVATE "-O3")

    set_target_properties(DiffViewWASM PROPERTIES SUFFIX ".js")

    target_link_options(DiffViewWASM PRIVATE
            "--bind"
            "-sMODULARIZE=1"
            "-sEXPORT_ES6=1"
            "-sEXPORT_NAME=DIFF_VIEWWASMModule"
            "-sNO_DISABLE_EXCEPTION_CATCHING"
    )
endif()