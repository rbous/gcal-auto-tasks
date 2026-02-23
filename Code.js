function updateTaggedTasksWithSubtasks() {
  console.log("Starting tagged recurring task update (v27 - Skip Current Period for No-Date Tasks)...");

  try {
    const taskLists = Tasks.Tasklists.list().items;
    if (!taskLists) {
      console.log("No task lists found.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const list of taskLists) {
      const allTasksInList = Tasks.Tasks.list(list.id, { showCompleted: true, showHidden: true }).items;
      if (!allTasksInList) continue;

      // Find both completed AND uncompleted tagged tasks (with or without subtasks)
      const taggedTasks = allTasksInList.filter(task =>
        task.notes && (task.notes.includes('#daily') || task.notes.includes('#weekly') || task.notes.includes('#monthly'))
      );

      for (const task of taggedTasks) {
        const isTaskCompleted = task.status === 'completed';
        
        if (isTaskCompleted) {
          // --- COMPLETED TASK: Update in place ---
          console.log(`Found completed task: "${task.title}" (ID: ${task.id}). Resetting...`);
         
          // Determine the new due date based on the OLD due date
          let nextDueDate = null;
          const oldDueDate = task.due ? new Date(task.due) : null;
          
          if (task.notes.includes('#daily')) {
            // Daily: always set to today
            nextDueDate = new Date(today);
          } else if (task.notes.includes('#weekly')) {
            // Weekly: find next occurrence of the same day of week
            if (oldDueDate) {
              nextDueDate = new Date(oldDueDate);
              nextDueDate.setDate(nextDueDate.getDate() + 7); // Move to next week
              console.log(`  Weekly task: Original day was ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][oldDueDate.getDay()]}, next due: ${nextDueDate.toISOString()}`);
            } else {
              // No old due date - assume this week's is done, set to NEXT week's Sunday
              nextDueDate = new Date(today);
              const daysUntilSunday = (7 - nextDueDate.getDay()) % 7;
              nextDueDate.setDate(nextDueDate.getDate() + daysUntilSunday);
              
              // If we landed on today or already passed this week's Sunday, add another 7 days
              if (nextDueDate <= today) {
                nextDueDate.setDate(nextDueDate.getDate() + 7);
              }
              
              console.log(`  Weekly task with no due date: Assuming this week is done, setting to next week's Sunday: ${nextDueDate.toISOString()}`);
            }
          } else if (task.notes.includes('#monthly')) {
            // Monthly: find next occurrence of the same day of month
            if (oldDueDate) {
              const targetDayOfMonth = oldDueDate.getDate();
              nextDueDate = new Date(oldDueDate);
              nextDueDate.setMonth(nextDueDate.getMonth() + 1); // Move to next month
              console.log(`  Monthly task: Original day was ${targetDayOfMonth}, next due: ${nextDueDate.toISOString()}`);
            } else {
              // No old due date - assume this month's is done, set to NEXT month's last day
              nextDueDate = new Date(today.getFullYear(), today.getMonth() + 2, 0); // Last day of NEXT month
              console.log(`  Monthly task with no due date: Assuming this month is done, setting to last day of next month: ${nextDueDate.toISOString()}`);
            }
          }
          
          if (!nextDueDate) continue;

          try {
            // Verify the task ID exists
            if (!task.id) {
              console.error(`Task "${task.title}" has no ID!`);
              continue;
            }

            // 1. Find all subtasks (if any)
            const subtasks = allTasksInList.filter(sub => sub.parent === task.id);

            if (subtasks.length > 0) {
              // HAS SUBTASKS - Archive old subtasks with parent's old due date
              console.log(`Task has ${subtasks.length} subtasks. Archiving them with old due date...`);
              
              const taskOldDueDate = task.due; // Store the OLD due date
              
              for (const subtask of subtasks) {
                try {
                  if (!subtask.id) {
                    console.error(`  Subtask "${subtask.title}" has no ID!`);
                    continue;
                  }

                  // Inherit parent's old due date
                  const updatedSubtask = Tasks.Tasks.update(
                    {
                      id: subtask.id,
                      title: subtask.title,
                      notes: subtask.notes,
                      parent: task.id,
                      status: subtask.status, // Keep current status
                      due: taskOldDueDate || null
                    },
                    list.id,
                    subtask.id
                  );
                  console.log(`  Archived subtask: "${updatedSubtask.title}" with due: ${taskOldDueDate || 'none'}`);
                } catch (e) {
                  console.error(`  Failed to update subtask "${subtask.title}" (ID: ${subtask.id}): ${e.toString()}`);
                }
              }

              // 2. Update the parent task (uncheck it and update due date)
              const updatedTask = Tasks.Tasks.update(
                {
                  id: task.id,
                  title: task.title,
                  notes: task.notes,
                  status: 'needsAction',
                  due: nextDueDate.toISOString()
                },
                list.id,
                task.id
              );
              console.log(`Successfully reset parent: "${updatedTask.title}" with new due date: ${nextDueDate.toISOString()}`);

              // 3. Reset subtasks to unchecked with NO due date
              console.log(`Resetting ${subtasks.length} subtasks (unchecked, no due date)...`);
              
              for (const subtask of subtasks) {
                try {
                  if (!subtask.id) continue;

                  const updatedSubtask = Tasks.Tasks.update(
                    {
                      id: subtask.id,
                      title: subtask.title,
                      notes: subtask.notes,
                      parent: task.id,
                      status: 'needsAction',
                      due: null // No due date for fresh subtasks
                    },
                    list.id,
                    subtask.id
                  );
                  console.log(`  Reset subtask: "${updatedSubtask.title}" (no due date)`);
                } catch (e) {
                  console.error(`  Failed to reset subtask "${subtask.title}" (ID: ${subtask.id}): ${e.toString()}`);
                }
              }
            } else {
              // NO SUBTASKS - Just reset the task itself
              console.log(`Task has no subtasks. Simply resetting task...`);
              
              const updatedTask = Tasks.Tasks.update(
                {
                  id: task.id,
                  title: task.title,
                  notes: task.notes,
                  status: 'needsAction',
                  due: nextDueDate.toISOString()
                },
                list.id,
                task.id
              );
              console.log(`Successfully reset standalone task: "${updatedTask.title}" with new due date: ${nextDueDate.toISOString()}`);
            }

          } catch (e) {
            console.error(`An error occurred while resetting "${task.title}": ${e.toString()}`);
          }
          
        } else {
          // --- UNCOMPLETED TASK: Smart subtask handling ---
          const subtasks = allTasksInList.filter(sub => sub.parent === task.id);
          
          if (subtasks.length > 0) {
            // HAS SUBTASKS - Check if we need to process it
            const completedSubtasks = subtasks.filter(sub => sub.status === 'completed');
            const uncompletedSubtasks = subtasks.filter(sub => sub.status !== 'completed');
            
            // Check if parent is overdue
            const taskDueDate = task.due ? new Date(task.due) : null;
            const isOverdue = taskDueDate && taskDueDate < today;
            
            // Only process if there are completed subtasks OR parent is overdue
            if (completedSubtasks.length > 0 || isOverdue) {
              console.log(`Found uncompleted parent "${task.title}" (${isOverdue ? 'OVERDUE' : 'not overdue'}) with ${completedSubtasks.length} completed and ${uncompletedSubtasks.length} uncompleted subtask(s).`);
              
              // IMPORTANT: Capture parent's OLD due date BEFORE any updates
              const taskOldDueDate = task.due;
              console.log(`  Parent's current due date: ${taskOldDueDate || 'none'}`);
              
              // Determine the new due date for parent based on task type
              let newTaskDueDate = null;
              
              if (task.notes.includes('#daily')) {
                // Daily: always set to today
                newTaskDueDate = new Date(today);
              } else if (task.notes.includes('#weekly')) {
                // Weekly: find next occurrence of the same day of week from the OLD due date
                if (taskDueDate) {
                  const targetDayOfWeek = taskDueDate.getDay();
                  newTaskDueDate = new Date(taskDueDate);
                  newTaskDueDate.setDate(newTaskDueDate.getDate() + 7); // Move to next week
                  console.log(`  Weekly task update: Moving from ${taskDueDate.toISOString()} to ${newTaskDueDate.toISOString()}`);
                } else {
                  // No due date - should not happen for overdue tasks, but handle it
                  newTaskDueDate = new Date(today);
                  const daysUntilSunday = (7 - newTaskDueDate.getDay()) % 7;
                  newTaskDueDate.setDate(newTaskDueDate.getDate() + daysUntilSunday);
                  if (newTaskDueDate <= today) {
                    newTaskDueDate.setDate(newTaskDueDate.getDate() + 7);
                  }
                  console.log(`  Weekly task with no due date: Setting to next week's Sunday: ${newTaskDueDate.toISOString()}`);
                }
              } else if (task.notes.includes('#monthly')) {
                // Monthly: find next occurrence of the same day of month from the OLD due date
                if (taskDueDate) {
                  newTaskDueDate = new Date(taskDueDate);
                  newTaskDueDate.setMonth(newTaskDueDate.getMonth() + 1); // Move to next month
                  console.log(`  Monthly task update: Moving from ${taskDueDate.toISOString()} to ${newTaskDueDate.toISOString()}`);
                } else {
                  // No due date - should not happen for overdue tasks, but handle it
                  newTaskDueDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                  console.log(`  Monthly task with no due date: Setting to last day of next month: ${newTaskDueDate.toISOString()}`);
                }
              }
              
              if (!newTaskDueDate) {
                newTaskDueDate = new Date(today); // Fallback
              }
              
              // 1. Handle uncompleted subtasks FIRST - assign parent's OLD due date (only if parent is overdue)
              if (uncompletedSubtasks.length > 0 && isOverdue) {
                console.log(`  Assigning old due date (${taskOldDueDate || 'none'}) to ${uncompletedSubtasks.length} uncompleted subtask(s)...`);
                for (const subtask of uncompletedSubtasks) {
                  try {
                    if (!subtask.id) {
                      console.error(`    Subtask "${subtask.title}" has no ID!`);
                      continue;
                    }

                    console.log(`    Processing uncompleted subtask: "${subtask.title}" (current due: ${subtask.due || 'none'})`);
                    
                    const updatedSubtask = Tasks.Tasks.update(
                      { 
                        id: subtask.id,
                        title: subtask.title,
                        notes: subtask.notes,
                        parent: task.id,
                        status: subtask.status,
                        due: taskOldDueDate // Assign parent's old due date
                      },
                      list.id,
                      subtask.id
                    );
                    console.log(`    ✓ Assigned old due date to: "${updatedSubtask.title}" (new due: ${updatedSubtask.due || 'none'})`);
                  } catch (e) {
                    console.error(`    Failed to update subtask "${subtask.title}" (ID: ${subtask.id}): ${e.toString()}`);
                  }
                }
              }
              
              // 2. Handle completed subtasks - uncheck and remove due date
              if (completedSubtasks.length > 0) {
                console.log(`  Resetting ${completedSubtasks.length} completed subtask(s)...`);
                for (const subtask of completedSubtasks) {
                  try {
                    if (!subtask.id) {
                      console.error(`    Subtask "${subtask.title}" has no ID!`);
                      continue;
                    }

                    const updatedSubtask = Tasks.Tasks.update(
                      { 
                        id: subtask.id,
                        title: subtask.title,
                        notes: subtask.notes,
                        parent: task.id,
                        status: 'needsAction',
                        due: null // Remove due date (fresh start)
                      },
                      list.id,
                      subtask.id
                    );
                    console.log(`    ✓ Unchecked and removed due date: "${updatedSubtask.title}"`);
                  } catch (e) {
                    console.error(`    Failed to update subtask "${subtask.title}" (ID: ${subtask.id}): ${e.toString()}`);
                  }
                }
              }
              
              // 3. Update parent task to the new calculated date (only if overdue or has completed subtasks)
              if (isOverdue || completedSubtasks.length > 0) {
                try {
                  const updatedTask = Tasks.Tasks.update(
                    {
                      id: task.id,
                      title: task.title,
                      notes: task.notes,
                      status: task.status,
                      due: newTaskDueDate.toISOString()
                    },
                    list.id,
                    task.id
                  );
                  console.log(`  ✓ Updated parent due date from ${taskOldDueDate || 'none'} to ${newTaskDueDate.toISOString()}`);
                } catch (e) {
                  console.error(`  Failed to update parent task: ${e.toString()}`);
                }
              }
            } else {
              console.log(`Skipping uncompleted parent "${task.title}" - not overdue and no completed subtasks.`);
            }
          } else {
            // NO SUBTASKS and UNCOMPLETED - Leave it completely alone for accountability
            console.log(`Found uncompleted standalone task "${task.title}" with no subtasks. Keeping it unchanged for accountability.`);
          }
        }
      }
    }
    console.log("Tagged task update complete.");
  } catch (e) {
    console.error(`An error occurred during the update: ${e.toString()}`);
  }
}