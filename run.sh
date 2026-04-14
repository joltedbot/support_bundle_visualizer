#!/bin/bash
pnpm run generate -- --customer $1 --name $2
pnpm run build
