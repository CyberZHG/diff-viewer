// @ts-ignore
import { init } from '../../wasm/index.js';
import { DiffEditor } from './diff-editor';

init().then(() => new DiffEditor());
