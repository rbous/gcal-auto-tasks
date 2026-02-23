# Google Tasks Auto-Recurring with Subtasks

A Google Apps Script that brings powerful "Smart Recurrence" to Google Tasks. Unlike the default recurring feature, this script correctly handles **subtasks**, resetting them whenever the parent task is completed or moves to a new period.

## Features

- **Tag-Based Recurrence**: Simply add `#daily`, `#weekly`, or `#monthly` to your task notes.
- **Subtask Resetting**: When a parent task is completed, all its subtasks are automatically unchecked and their due dates cleared for a "fresh start."
- **Overdue Accountability**: If a task is overdue, the script "archives" the uncompleted subtasks by assigning them the parent's old due date before moving the parent task to the next period.
- **Smart Date Calculation**:
  - **#daily**: Resets to today.
  - **#weekly**: Moves to the same day next week (or next Sunday if no date was set).
  - **#monthly**: Moves to the same day next month (or the last day of next month if no date was set).

## Setup Instructions

### 1. Create the Script
1. Go to [script.google.com](https://script.google.com).
2. Click **New Project**.
3. Copy the code from `Code.gs` in this repo and paste it into the editor.

### 2. Enable the Tasks API
1. In the Apps Script editor, click the **+** next to **Services** on the left sidebar.
2. Select **Google Tasks API**.
3. Click **Add**.

### 3. Set the Trigger (Crucial)
To make this automatic, you need to tell Google to run it periodically:
1. Click the **Triggers** (alarm clock icon) on the left sidebar.
2. Click **+ Add Trigger**.
3. Select `updateTaggedTasksWithSubtasks` as the function to run.
4. Select **Time-driven** as the event source.
5. Choose your frequency (e.g., **Day timer** -> **Midnight to 1am**).

## How to Use

Simply create a task in Google Tasks and add one of these tags to the **Notes** field:

- `#daily`: Tasks you do every day.
- `#weekly`: Tasks for a specific day each week.
- `#monthly`: Tasks for a specific date each month.

**Example:**
- **Task Title**: Clean the Kitchen
- **Notes**: Do a deep clean of the counters. #weekly
- **Subtasks**: 
  - Wipe Stove
  - Empty Trash
  - Mop Floor

When you complete "Clean the Kitchen," the script will see the `#weekly` tag, uncheck the three subtasks, and move the parent task's due date to next week.

## Requirements
- You must have the **Google Tasks API** service enabled in your Google Apps Script project.
- The script relies on the **Notes** field containing exactly `#daily`, `#weekly`, or `#monthly`.

## License
This project is open-source. Feel free to fork and modify!
