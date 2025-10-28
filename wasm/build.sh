#!/usr/bin/env bash

emcmake cmake .. -B wasm -DDIFF_VIEW_BIND_ES=ON
(cd wasm && emmake make DiffViewWASM)
