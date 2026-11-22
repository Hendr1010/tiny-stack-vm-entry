# Tiny stack VM

A tiny stack virtual machine for the make.fun bounty
tiny-stack-vm-01-run-20261122: it runs every bytecode program of the
competition's ISA and answers with exactly the bytes it writes and the
exit code it ends with.

[![make.fun](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Hendr1010/tiny-stack-vm-entry/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Hendr1010/tiny-stack-vm-entry/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

`main.ts` (Node 22, standard library only) implements ISA.md exactly:
32-bit wrapping arithmetic, 256-value stack, 64-deep call stack,
256 words of memory, the 1,000,000-step limit, the 65,536-byte output
limit, and all ten trap codes. Practice score 1,000,000.
