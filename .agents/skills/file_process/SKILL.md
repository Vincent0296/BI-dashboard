---
name: file_process
description: >-
  Use this skill to clear numeric data (to prevent leakage of sensitive financial/budget numbers) and safely rename Excel files in a folder based on a keyword mapping template CSV.
---

# File Process Skill

This skill automates the workflow of sanitizing sensitive financial/budget data and renaming spreadsheets in a target directory based on keyword mapping rules.

## Core Features
1. **Confidentiality Protection**: Clear all numeric cells (including formula results that resolve to a number) while keeping all text, layout, headers, and hyperlinks.
2. **Template-Based Renaming**: Maps files using keywords inside a GBK-encoded CSV mapping template.
3. **Collision Avoidance**: Safely resolves duplicate target names by appending suffixes (e.g. `Name.xlsx`, `Name1.xlsx`) and performs renaming in two stages using temporary filenames to avoid overwrite errors.

## Directory Structure
- Main runbook: [SKILL.md](file:///Users/Vincent/Documents/Test/project/.agents/skills/file_process/SKILL.md)
- Helper script: [clear_and_rename.ts](file:///Users/Vincent/Documents/Test/project/.agents/skills/file_process/scripts/clear_and_rename.ts)

## Prerequisites
- Node.js installed.
- Dependencies: `exceljs` and `tsx` installed in the project.

## How to Execute

### 1. Pre-Execution Backup (Crucial)
Always back up the target directory before executing in-place modifications:
```bash
cp -R <TARGET_DIR> <TARGET_DIR>_backup
```

### 2. Run the Script
Execute the script using `tsx` from the project root:
```bash
npx tsx .agents/skills/file_process/scripts/clear_and_rename.ts [target_dir] [csv_template_path]
```
If arguments are omitted, they will default to:
- Directory: `/Users/Vincent/Documents/Test/project/scratch/预算执行分析202607`
- CSV Path: `/Users/Vincent/Documents/Test/project/scratch/重命名模版.csv`

### 3. Verify Results
- Confirm all numeric values (`cell.type === ExcelJS.ValueType.Number` or numeric formula result) are empty (`null`).
- Verify text headers are preserved.
- Verify files are renamed correctly without loss.
