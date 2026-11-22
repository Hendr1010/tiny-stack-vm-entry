// Tiny stack VM: runs /input/<id>/{program,input}.bin, writes /output/<id>/{stdout.bin,exit.txt}.
// ISA.md + reference vm.mjs: 32-bit wrapping, 256-value stack, 64-deep call stack, 256 words of
// memory, step limit 1,000,000, output limit 65,536, ten trap codes. Node 22, standard library only.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// Opcode byte -> "imm pops pushes" digits; imm -1 = byte names no opcode (trap 5).
const IMM = new Int8Array(256).fill(-1), POPS = new Int8Array(256), PUSHES = new Int8Array(256);
for (const e of '00-000,01-101,02-401,03-010,04-012,05-022,06-023,07-033,10-021,11-021,12-021,13-021,14-021,15-021,16-021,17-011,18-021,19-021,1a-021,1b-011,1c-021,1d-021,1e-021,20-021,21-021,22-021,30-200,31-210,32-210,33-200,34-000,40-011,41-020,50-010,51-010,52-001,53-010'.split(',')) {
  const b = parseInt(e.slice(0, 2), 16);
  IMM[b] = +e[3]; POPS[b] = +e[4]; PUSHES[b] = +e[5];
}
const digits = new Uint8Array(12); // scratch space for PRINT's decimal digits
function run(program: Uint8Array, input: Uint8Array) {
  const n = program.length;
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let csp = 0;
  const M = new Int32Array(256);
  const out = new Uint8Array(65536);
  let olen = 0, inPos = 0, pc = 0, steps = 0;
  const end = (exit: number) => ({ out, len: olen, exit });
  for (;;) {
    // ISA.md "One step", in this order: step limit, pc bounds, opcode, immediate fit.
    if (steps === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = program[pc], imm = IMM[op];
    if (imm < 0) return end(5);
    if (pc + imm >= n) return end(9);
    steps++;
    const next = pc + 1 + imm, pops = POPS[op], pushes = PUSHES[op];
    if (sp < pops) return end(2);
    if (sp - pops + pushes > 256) return end(3);
    pc = next;
    switch (op) {
      case 0x00: return end(0);
      case 0x01: D[sp++] = (program[next - 1] << 24) >> 24; break;
      case 0x02: D[sp++] = program[next - 4] | (program[next - 3] << 8) | (program[next - 2] << 16) | (program[next - 1] << 24); break;
      case 0x03: sp--; break;
      case 0x04: D[sp] = D[sp - 1]; sp++; break;
      case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 0x06: D[sp] = D[sp - 2]; sp++; break;
      case 0x07: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 0x17: D[sp - 1] = -D[sp - 1] | 0; break;
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16: case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e: case 0x20: case 0x21: case 0x22: {
        const b = D[sp - 1], a = D[sp - 2];
        let r = 0;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (b === 0) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 0x14) { if (b === 0) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 0x15) { if (b === 0) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (b === 0) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; D[sp++] = r; break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((program[next - 2] | (program[next - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 0x30) { const v = D[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
        if (take) pc = next + rel;
        break;
      }
      case 0x33:
        if (csp === 64) return end(7);
        C[csp++] = next; pc = program[next - 2] | (program[next - 1] << 8); break;
      case 0x34:
        if (csp === 0) return end(8);
        pc = C[--csp]; break;
      case 0x40: {
        const addr = D[sp - 1];
        if (addr < 0 || addr >= 256) return end(6);
        D[sp - 1] = M[addr]; break;
      }
      case 0x41: {
        const addr = D[sp - 1], v = D[sp - 2];
        if (addr < 0 || addr >= 256) return end(6);
        sp -= 2; M[addr] = v; break;
      }
      case 0x50: {
        // Decimal text of the value; a write past the output limit traps 11 and writes nothing.
        const v = D[sp - 1];
        let u = v, neg = false;
        if (v < 0) { neg = true; u = -v; }
        let i = 12;
        if (u === 0) digits[--i] = 48;
        else while (u > 0) { digits[--i] = 48 + (u % 10); u = Math.floor(u / 10); }
        if (neg) digits[--i] = 45;
        const len = 12 - i;
        if (olen + len > 65536) return end(11);
        sp--; out.set(digits.subarray(i, 12), olen); olen += len; break;
      }
      case 0x51:
        if (olen + 1 > 65536) return end(11);
        out[olen++] = D[--sp] & 255; break;
      case 0x52: D[sp++] = inPos < input.length ? input[inPos++] : -1; break;
      case 0x53: return end(D[--sp] & 255);
    }
  }
}
for (const id of readdirSync(I).sort()) {
  const program = readFileSync(join(I, id, 'program.bin'));
  const input = readFileSync(join(I, id, 'input.bin'));
  const r = run(program, input);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out.subarray(0, r.len));
  writeFileSync(join(O, id, 'exit.txt'), r.exit + '\n');
}
