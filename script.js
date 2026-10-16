var KEY="habits-v1",PROFILE_KEY="orbit-profile-v1",REMINDER_KEY="orbit-reminder-v1",TASKS_KEY="orbit-student-tasks-v1",FOCUS_KEY="orbit-focus-session-v1",TASK_REMINDER_KEY="orbit-task-reminder-v1",GOALS_KEY="orbit-goals-v1",REVIEWS_KEY="orbit-weekly-reviews-v1",habits=[],tasksByDate={},goals=[],weeklyReviews={},focusState=null,taskReminderState=null,plannerWeekOffset=0,reviewWeekOffset=-1,reviewDisplayedWeekKey=null,COL=["#7c5cff","#ff6b8b","#2fd9a8","#ffb02e","#4cc3ff"],lastPop=null;
function asText(value){return typeof value==="string"?value:""}
function parseDurationFromName(name){
  if(typeof name!=="string")return null;
  var matches=name.match(/(\d+)\s*(?:hours?|hrs?|hr|h|minutes?|mins?|min|m)/gi);
  if(!matches||!matches.length)return null;
  var totalMinutes=0;
  matches.forEach(function(match){
    var parts=match.trim().match(/(\d+)\s*(.*)/i);
    if(!parts||!parts[1])return;
    var value=Number(parts[1]);
    var unit=asText(parts[2]).toLowerCase();
    if(!Number.isFinite(value)||value<0)return;
    if(/^(hours?|hrs?|hr|h)$/.test(unit))totalMinutes+=value*60;
    else if(/^(minutes?|mins?|min|m)$/.test(unit))totalMinutes+=value;
  });
  return totalMinutes>0?totalMinutes:null;
}
function normalizeHabit(h){
  if(!h||typeof h!=="object")return null;
  var name=asText(h.name).trim();
  if(!name)return null;
  var log=h.log&&typeof h.log==="object"&&!Array.isArray(h.log)?h.log:{};
  var days=Array.isArray(h.days)?Array.from(new Set(h.days.filter(function(day){return Number.isInteger(day)&&day>=0&&day<=6}))):[0,1,2,3,4,5,6];
  if(!days.length)days=[0,1,2,3,4,5,6];
  var note=typeof h.note==="string"?h.note.trim():"";
  if(note.length>240)note=note.slice(0,240);
  var durationMinutes=parseDurationFromName(name);
  var timer=h.timer&&typeof h.timer==="object"&&!Array.isArray(h.timer)?h.timer:{};
  var elapsedMs=Number(timer.elapsedMs)||0;
  var startedAt=Number(timer.startedAt)||null;
  if(!Number.isFinite(elapsedMs)||elapsedMs<0)elapsedMs=0;
  if(durationMinutes!==null&&durationMinutes>0&&elapsedMs>durationMinutes*60000)elapsedMs=durationMinutes*60000;
  return {name:name,log:log,days:days,note:note,durationMinutes:durationMinutes,timer:{running:!!timer.running,startedAt:startedAt,elapsedMs:elapsedMs}};
}
function sanitizeHabits(list){
  if(!Array.isArray(list))return [];
  return list.map(normalizeHabit).filter(Boolean);
}
try{habits=sanitizeHabits(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch(e){habits=[]}
try{tasksByDate=sanitizeTaskMap(JSON.parse(localStorage.getItem(TASKS_KEY)||"{}"))}catch(e){tasksByDate={}}
try{goals=sanitizeGoals(JSON.parse(localStorage.getItem(GOALS_KEY)||"[]"))}catch(e){goals=[]}
try{weeklyReviews=sanitizeWeeklyReviews(JSON.parse(localStorage.getItem(REVIEWS_KEY)||"{}"))}catch(e){weeklyReviews={}}
try{focusState=normalizeFocusState(JSON.parse(localStorage.getItem(FOCUS_KEY)||"null"))}catch(e){focusState=normalizeFocusState(null)}
try{taskReminderState=normalizeTaskReminder(JSON.parse(localStorage.getItem(TASK_REMINDER_KEY)||"null"))}catch(e){taskReminderState=normalizeTaskReminder(null)}
function save(){try{habits=habits.map(normalizeHabit).filter(Boolean);localStorage.setItem(KEY,JSON.stringify(habits))}catch(e){}}
function readProfile(){try{var profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||"null");return profile&&typeof profile==="object"?profile:null}catch(e){return null}}
function saveProfile(profile){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));return true}catch(e){return false}}
function readReminder(){try{var reminder=JSON.parse(localStorage.getItem(REMINDER_KEY)||"null");return reminder&&typeof reminder==="object"?reminder:null}catch(e){return null}}
function saveReminder(state){try{localStorage.setItem(REMINDER_KEY,JSON.stringify(state));return true}catch(e){return false}}
function getReminderState(){var reminder=readReminder()||{};return Object.assign({enabled:false,time:"20:00",lastNotified:null},reminder)}
function validDateKey(key){if(typeof key!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(key))return false;var date=new Date(key+"T00:00:00");return !Number.isNaN(date.getTime())&&ds(date)===key}
function sanitizeWeeklyReviews(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  var result={};
  Object.keys(value).filter(validDateKey).sort().slice(-260).forEach(function(key){
    var review=value[key];
    if(!review||typeof review!=="object"||Array.isArray(review))return;
    result[key]={reflection:asText(review.reflection).slice(0,600),priorities:asText(review.priorities).slice(0,600)};
  });
  return result;
}
function normalizeTask(task){
  if(!task||typeof task!=="object"||Array.isArray(task))return null;
  var title=asText(task.title).trim(),dueTime=asText(task.dueTime),priority=["high","medium","low"].indexOf(task.priority)!==-1?task.priority:"medium";
  if(!title||title.length>120||(dueTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)))return null;
  var estimateMinutes=Number.isInteger(task.estimateMinutes)&&task.estimateMinutes>=1&&task.estimateMinutes<=720?task.estimateMinutes:30;
  var subtasks=Array.isArray(task.subtasks)?task.subtasks.slice(0,40).map(function(subtask){
    if(!subtask||typeof subtask!=="object"||Array.isArray(subtask))return null;
    var subtaskTitle=asText(subtask.title).trim();
    return subtaskTitle&&subtaskTitle.length<=120?{title:subtaskTitle,completed:subtask.completed===true}:null;
  }).filter(Boolean):[];
  var milestoneId=typeof task.milestoneId==="string"&&/^[a-z0-9-]{1,64}$/.test(task.milestoneId)?task.milestoneId:"";
  return {title:title,dueTime:dueTime,priority:priority,estimateMinutes:estimateMinutes,completed:task.completed===true,subtasks:subtasks,milestoneId:milestoneId};
}
function sanitizeTaskMap(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  var result={};
  Object.keys(value).forEach(function(key){
    if(!validDateKey(key)||!Array.isArray(value[key]))return;
    result[key]=value[key].map(normalizeTask).filter(Boolean);
  });
  return result;
}
function normalizeGoal(goal){
  if(!goal||typeof goal!=="object"||Array.isArray(goal))return null;
  var id=asText(goal.id),title=asText(goal.title).trim(),targetDate=asText(goal.targetDate);
  if(!/^[a-z0-9-]{1,64}$/.test(id)||!title||title.length>120||!validDateKey(targetDate))return null;
  var milestones=Array.isArray(goal.milestones)?goal.milestones.slice(0,40).map(function(milestone){
    if(!milestone||typeof milestone!=="object"||Array.isArray(milestone))return null;
    var milestoneId=asText(milestone.id),milestoneTitle=asText(milestone.title).trim();
    return /^[a-z0-9-]{1,64}$/.test(milestoneId)&&milestoneTitle&&milestoneTitle.length<=120?{id:milestoneId,title:milestoneTitle,completed:milestone.completed===true}:null;
  }).filter(Boolean):[];
  return {id:id,title:title,targetDate:targetDate,milestones:milestones};
}
function sanitizeGoals(value){
  if(!Array.isArray(value))return [];
  var seenIds={};
  return value.slice(0,50).map(normalizeGoal).filter(function(goal){
    if(!goal||seenIds[goal.id])return false;
    seenIds[goal.id]=true;
    return true;
  });
}
function createEntryId(prefix){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function findMilestone(milestoneId){
  if(!milestoneId)return null;
  for(var goalIndex=0;goalIndex<goals.length;goalIndex++){
    var milestone=goals[goalIndex].milestones.find(function(item){return item.id===milestoneId});
    if(milestone)return {goal:goals[goalIndex],milestone:milestone};
  }
  return null;
}
function saveGoals(nextGoals){
  var normalized=sanitizeGoals(nextGoals);
  try{localStorage.setItem(GOALS_KEY,JSON.stringify(normalized))}
  catch(error){console.error("Unable to save student goals.",error);var status=document.getElementById("goal-status");if(status)status.textContent="Could not save your goals. Check this browser's storage settings and try again.";return false}
  goals=normalized;
  updateMilestoneOptions();
  renderTodayTasks();
  return true;
}
function normalizeTaskReminder(value){
  var reminder=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  return {enabled:reminder.enabled===true,lastNotified:validDateKey(reminder.lastNotified)?reminder.lastNotified:null};
}
function saveTaskReminder(){
  taskReminderState=normalizeTaskReminder(taskReminderState);
  try{localStorage.setItem(TASK_REMINDER_KEY,JSON.stringify(taskReminderState));return true}
  catch(error){console.error("Unable to save end-of-day task reminder settings.",error);var status=document.getElementById("task-reminder-status");if(status)status.textContent="Could not save reminder settings. Check this browser's storage settings and try again.";return false}
}
function normalizeFocusState(value){
  var state=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  var focusMinutes=Number.isInteger(state.focusMinutes)&&state.focusMinutes>=1&&state.focusMinutes<=720?state.focusMinutes:25;
  var breakMinutes=Number.isInteger(state.breakMinutes)&&state.breakMinutes>=1&&state.breakMinutes<=60?state.breakMinutes:5;
  var phase=state.phase==="break"?"break":"focus";
  var status=["ready","running","paused","focus-done","break-done"].indexOf(state.status)!==-1?state.status:"ready";
  var defaultRemaining=(phase==="focus"?focusMinutes:breakMinutes)*60000;
  var remainingMs=Number.isFinite(Number(state.remainingMs))?Number(state.remainingMs):defaultRemaining;
  remainingMs=Math.max(0,Math.min(defaultRemaining,remainingMs));
  var startedAt=state.startedAt===null||state.startedAt===undefined?null:(Number.isFinite(Number(state.startedAt))?Number(state.startedAt):null);
  var completedDate=validDateKey(state.completedDate)?state.completedDate:ds(new Date());
  var completedSessions=completedDate===ds(new Date())&&Number.isInteger(state.completedSessions)&&state.completedSessions>=0?state.completedSessions:0;
  var focusHistory={};
  if(state.focusHistory&&typeof state.focusHistory==="object"&&!Array.isArray(state.focusHistory)){
    Object.keys(state.focusHistory).filter(validDateKey).sort().slice(-400).forEach(function(key){
      var count=state.focusHistory[key];
      if(Number.isInteger(count)&&count>=0)focusHistory[key]=count;
    });
  }
  if(!Object.prototype.hasOwnProperty.call(focusHistory,ds(new Date())))focusHistory[ds(new Date())]=completedSessions;
  if(status==="running"&&startedAt!==null){
    remainingMs=Math.max(0,remainingMs-(Date.now()-startedAt));
    startedAt=Date.now();
  }else if(status==="running"){
    status="paused";
  }
  return {phase:phase,status:status,focusMinutes:focusMinutes,breakMinutes:breakMinutes,remainingMs:remainingMs,startedAt:startedAt,taskTitle:asText(state.taskTitle).slice(0,120),completedSessions:completedSessions,completedDate:completedDate,focusHistory:focusHistory};
}
function saveFocusState(){
  focusState=normalizeFocusState(focusState);
  try{localStorage.setItem(FOCUS_KEY,JSON.stringify(focusState));return true}
  catch(error){console.error("Unable to save focus session.",error);var status=document.getElementById("focus-status");if(status)status.textContent="Could not save this focus session. Check this browser's storage settings and try again.";return false}
}
function getFocusState(){return focusState||normalizeFocusState(null)}
function notifyFocus(message){
  showToast(message);
  if("Notification" in window&&Notification.permission==="granted")new Notification("Orbit focus session",{body:message,tag:"orbit-focus-session"});
}
function getTodayTasks(){return tasksByDate[ds(new Date())]||[]}
function updateTaskReminderUI(){
  var button=document.getElementById("task-reminder-toggle"),status=document.getElementById("task-reminder-status");
  if(!button||!status)return;
  var reminder=normalizeTaskReminder(taskReminderState);
  button.textContent=reminder.enabled?"Disable reminder":"Enable reminder";
  status.textContent=reminder.enabled
    ?("On. If tasks remain incomplete, Orbit will send a gentle reminder at 11:00 PM"+(("Notification" in window&&Notification.permission!=="granted")?"; desktop notifications are unavailable, so the in-app reminder appears while the dashboard is open.":"."))
    :"Reminder off. Turn it on for a gentle nudge if tasks are still unfinished.";
}
function checkTaskReminder(now){
  var reminder=normalizeTaskReminder(taskReminderState),current=now instanceof Date?now:new Date(),today=ds(current);
  if(!reminder.enabled||reminder.lastNotified===today||current.getHours()<23)return false;
  var unfinished=getTodayTasks().filter(function(task){return !task.completed});
  if(!unfinished.length)return false;
  reminder.lastNotified=today;
  taskReminderState=reminder;
  if(!saveTaskReminder())return false;
  var message=unfinished.length===1
    ?"There's still one task on today's list. You can take one small step before the day ends—you've got this."
    :"There are still "+unfinished.length+" tasks on today's list. Pick one small next step before the day ends—you've got this.";
  showToast(message);
  if("Notification" in window&&Notification.permission==="granted"){
    try{new Notification("A gentle Orbit reminder",{body:message,tag:"orbit-unfinished-tasks"})}
    catch(error){console.error("Unable to show the end-of-day task notification.",error)}
  }
  updateTaskReminderUI();
  return true;
}
function setupTaskReminder(){
  var button=document.getElementById("task-reminder-toggle");
  if(!button)return;
  updateTaskReminderUI();
  button.addEventListener("click",async function(){
    if(!taskReminderState.enabled&&"Notification" in window&&Notification.permission==="default"){
      try{await Notification.requestPermission()}
      catch(error){console.error("Unable to request browser notification permission.",error)}
    }
    taskReminderState.enabled=!taskReminderState.enabled;
    if(!saveTaskReminder())return;
    updateTaskReminderUI();
    if(taskReminderState.enabled){
      if("Notification" in window&&Notification.permission==="granted")showToast("End-of-day reminder enabled for 11:00 PM.");
      else showToast("In-app end-of-day reminder enabled for 11:00 PM. Keep the dashboard open to receive it.");
      checkTaskReminder(new Date());
    }else showToast("End-of-day task reminder turned off.");
  });
  setInterval(function(){checkTaskReminder(new Date())},30000);
  document.addEventListener("visibilitychange",function(){if(!document.hidden)checkTaskReminder(new Date())});
}
function saveTasksForDate(dateKey,nextTasks){
  if(!validDateKey(dateKey)){var invalidStatus=document.getElementById("task-status");if(invalidStatus)invalidStatus.textContent="Choose a valid date for this task.";return false}
  var nextMap=Object.assign({},tasksByDate);
  nextMap[dateKey]=nextTasks.map(normalizeTask).filter(Boolean);
  try{localStorage.setItem(TASKS_KEY,JSON.stringify(nextMap))}
  catch(error){console.error("Unable to save the student task list.",error);var status=document.getElementById("task-status");if(status)status.textContent="Could not save your task list. Check this browser's storage settings and try again.";return false}
  tasksByDate=nextMap;
  return true;
}
function saveTodayTasks(nextTasks){return saveTasksForDate(ds(new Date()),nextTasks)}
function createBackup(){return {app:"orbit-habit-tracker",version:1,exportedAt:new Date().toISOString(),habits:habits.map(normalizeHabit),profile:readProfile(),reminder:getReminderState(),tasks:sanitizeTaskMap(tasksByDate),goals:sanitizeGoals(goals),focus:normalizeFocusState(focusState),weeklyReviews:sanitizeWeeklyReviews(weeklyReviews),taskReminder:normalizeTaskReminder(taskReminderState)}}
function parseBackup(data){
  if(!data||typeof data!=="object"||Array.isArray(data)||data.app!=="orbit-habit-tracker"||data.version!==1||!Array.isArray(data.habits))throw new Error("This file is not a supported Orbit backup.");
  var restoredHabits=data.habits.map(function(habit){
    if(!habit||typeof habit!=="object"||Array.isArray(habit)||typeof habit.name!=="string"||!habit.name.trim()||habit.name.length>60||!habit.log||typeof habit.log!=="object"||Array.isArray(habit.log))throw new Error("The backup contains an invalid habit.");
    if(habit.days!==undefined&&(!Array.isArray(habit.days)||!habit.days.length||habit.days.some(function(day){return !Number.isInteger(day)||day<0||day>6})))throw new Error("The backup contains an invalid habit schedule.");
    if(habit.note!==undefined&&(typeof habit.note!=="string"||habit.note.length>240))throw new Error("The backup contains an invalid habit note.");
    Object.keys(habit.log).forEach(function(key){if(!validDateKey(key)||(habit.log[key]!==1&&habit.log[key]!==true))throw new Error("The backup contains invalid check-in data.")});
    return normalizeHabit(habit);
  });
  var profile=data.profile;
  if(profile!==null&&(!profile||typeof profile!=="object"||Array.isArray(profile)||typeof profile.name!=="string"))throw new Error("The backup contains an invalid profile.");
  var reminder=data.reminder;
  if(!reminder||typeof reminder!=="object"||Array.isArray(reminder)||typeof reminder.enabled!=="boolean"||typeof reminder.time!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time)||(reminder.lastNotified!==null&&reminder.lastNotified!==undefined&&!validDateKey(reminder.lastNotified)))throw new Error("The backup contains invalid reminder settings.");
  var restoredGoals=[];
  if(data.goals!==undefined){
    if(!Array.isArray(data.goals)||data.goals.length>50)throw new Error("The backup contains an invalid goals list.");
    var goalIds={},milestoneIds={};
    restoredGoals=data.goals.map(function(goal){
      var normalized=normalizeGoal(goal);
      if(!normalized||goalIds[normalized.id]||!Array.isArray(goal.milestones)||goal.milestones.length>40)throw new Error("The backup contains an invalid goal.");
      goalIds[normalized.id]=true;
      goal.milestones.forEach(function(milestone,index){
        if(!milestone||typeof milestone!=="object"||Array.isArray(milestone)||typeof milestone.id!=="string"||!/^([a-z0-9-]{1,64})$/.test(milestone.id)||typeof milestone.title!=="string"||!milestone.title.trim()||milestone.title.length>120||(milestone.completed!==undefined&&typeof milestone.completed!=="boolean")||milestoneIds[milestone.id])throw new Error("The backup contains an invalid goal milestone.");
        milestoneIds[milestone.id]=true;
        if(!normalized.milestones[index]||normalized.milestones[index].id!==milestone.id)throw new Error("The backup contains an invalid goal milestone.");
      });
      return normalized;
    });
  }
  var restoredTasks={};
  if(data.tasks!==undefined){
    if(!data.tasks||typeof data.tasks!=="object"||Array.isArray(data.tasks))throw new Error("The backup contains an invalid student task list.");
    Object.keys(data.tasks).forEach(function(key){
      if(!validDateKey(key)||!Array.isArray(data.tasks[key]))throw new Error("The backup contains an invalid student task date.");
      restoredTasks[key]=data.tasks[key].map(function(task){
        var normalized=normalizeTask(task);
        if(!normalized||(["high","medium","low"].indexOf(task.priority)!==-1?false:task.priority!==undefined)||((task.estimateMinutes!==undefined)&&(!Number.isInteger(task.estimateMinutes)||task.estimateMinutes<1||task.estimateMinutes>720))||(task.milestoneId!==undefined&&task.milestoneId!==""&&(typeof task.milestoneId!=="string"||!milestoneIds[task.milestoneId])))throw new Error("The backup contains an invalid student task.");
        if(task.subtasks!==undefined&&(!Array.isArray(task.subtasks)||task.subtasks.length>40||task.subtasks.some(function(subtask){return !subtask||typeof subtask!=="object"||Array.isArray(subtask)||typeof subtask.title!=="string"||!subtask.title.trim()||subtask.title.length>120||(subtask.completed!==undefined&&typeof subtask.completed!=="boolean")})))throw new Error("The backup contains invalid task steps.");
        return normalized;
      });
    });
  }
  var restoredFocus=data.focus===undefined?normalizeFocusState(null):normalizeFocusState(data.focus);
  if(data.focus!==undefined&&(!data.focus||typeof data.focus!=="object"||Array.isArray(data.focus)||!Number.isInteger(data.focus.focusMinutes)||data.focus.focusMinutes<1||data.focus.focusMinutes>720||!Number.isInteger(data.focus.breakMinutes)||data.focus.breakMinutes<1||data.focus.breakMinutes>60))throw new Error("The backup contains invalid focus session settings.");
  if(data.focus&&data.focus.focusHistory!==undefined&&(!data.focus.focusHistory||typeof data.focus.focusHistory!=="object"||Array.isArray(data.focus.focusHistory)||Object.keys(data.focus.focusHistory).some(function(key){return !validDateKey(key)||!Number.isInteger(data.focus.focusHistory[key])||data.focus.focusHistory[key]<0})))throw new Error("The backup contains invalid focus history.");
  var restoredWeeklyReviews={};
  if(data.weeklyReviews!==undefined){
    if(!data.weeklyReviews||typeof data.weeklyReviews!=="object"||Array.isArray(data.weeklyReviews)||Object.keys(data.weeklyReviews).some(function(key){var review=data.weeklyReviews[key];return !validDateKey(key)||!review||typeof review!=="object"||Array.isArray(review)||(review.reflection!==undefined&&(typeof review.reflection!=="string"||review.reflection.length>600))||(review.priorities!==undefined&&(typeof review.priorities!=="string"||review.priorities.length>600))}))throw new Error("The backup contains invalid weekly reviews.");
    restoredWeeklyReviews=sanitizeWeeklyReviews(data.weeklyReviews);
  }
  var restoredTaskReminder=data.taskReminder===undefined?normalizeTaskReminder(null):normalizeTaskReminder(data.taskReminder);
  if(data.taskReminder!==undefined&&(!data.taskReminder||typeof data.taskReminder!=="object"||Array.isArray(data.taskReminder)||typeof data.taskReminder.enabled!=="boolean"||(data.taskReminder.lastNotified!==null&&data.taskReminder.lastNotified!==undefined&&!validDateKey(data.taskReminder.lastNotified))))throw new Error("The backup contains invalid end-of-day reminder settings.");
  return {habits:restoredHabits,profile:profile,reminder:{enabled:reminder.enabled,time:reminder.time,lastNotified:reminder.lastNotified||null},tasks:restoredTasks,goals:restoredGoals,focus:restoredFocus,weeklyReviews:restoredWeeklyReviews,taskReminder:restoredTaskReminder};
}
function setBackupStatus(message,isError){var status=document.getElementById("backup-status");if(!status)return;status.textContent=message;status.classList.toggle("error",!!isError)}
function setupBackup(){
  var exportButton=document.getElementById("export-backup"),importButton=document.getElementById("import-backup"),fileInput=document.getElementById("backup-file");
  if(!exportButton||!importButton||!fileInput)return;
  exportButton.addEventListener("click",function(){
    try{
      var blob=new Blob([JSON.stringify(createBackup(),null,2)],{type:"application/json"});
      var url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download="orbit-backup-"+ds(new Date())+".json";link.click();
      setTimeout(function(){URL.revokeObjectURL(url)},1000);
      setBackupStatus("Backup downloaded. Keep the file somewhere safe.");
    }catch(error){console.error("Unable to export Orbit backup.",error);setBackupStatus("Could not download the backup. Try again.",true)}
  });
  importButton.addEventListener("click",function(){fileInput.click()});
  fileInput.addEventListener("change",function(){
    var file=fileInput.files&&fileInput.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onerror=function(){setBackupStatus("Could not read that file. Please try another backup.",true);fileInput.value=""};
    reader.onload=function(){
      try{
        var restored=parseBackup(JSON.parse(asText(reader.result)));
        if(!window.confirm("Restore this backup? It will replace the habits, goals, student task lists, weekly reviews, focus settings, and reminders currently saved in this browser.")){fileInput.value="";return}
        var oldValues={};
        [KEY,PROFILE_KEY,REMINDER_KEY,TASKS_KEY,GOALS_KEY,FOCUS_KEY,REVIEWS_KEY,TASK_REMINDER_KEY].forEach(function(key){oldValues[key]=localStorage.getItem(key)});
        try{
          localStorage.setItem(KEY,JSON.stringify(restored.habits));
          localStorage.setItem(PROFILE_KEY,JSON.stringify(restored.profile));
          localStorage.setItem(REMINDER_KEY,JSON.stringify(restored.reminder));
          localStorage.setItem(TASKS_KEY,JSON.stringify(restored.tasks));
          localStorage.setItem(GOALS_KEY,JSON.stringify(restored.goals));
          localStorage.setItem(FOCUS_KEY,JSON.stringify(restored.focus));
          localStorage.setItem(REVIEWS_KEY,JSON.stringify(restored.weeklyReviews));
          localStorage.setItem(TASK_REMINDER_KEY,JSON.stringify(restored.taskReminder));
        }catch(error){
          Object.keys(oldValues).forEach(function(key){try{if(oldValues[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,oldValues[key])}catch(rollbackError){console.error("Unable to roll back partially restored Orbit data for "+key+".",rollbackError)}});
          throw new Error("Could not save the backup in this browser. Your previous data was kept if storage allowed it.");
        }
        habits=restored.habits;
        tasksByDate=restored.tasks;
        goals=restored.goals;
        focusState=restored.focus;
        weeklyReviews=restored.weeklyReviews;
        reviewDisplayedWeekKey=null;
        taskReminderState=restored.taskReminder;
        renderGoals();
        updateMilestoneOptions();
        updateTaskReminderUI();
        updateReminderUI();
        render();
        setBackupStatus("Backup restored successfully.");
      }catch(error){console.error("Unable to restore Orbit backup.",error);setBackupStatus(error.message||"That backup could not be restored.",true)}
      fileInput.value="";
    };
    reader.readAsText(file);
  });
}
function showToast(message){var toast=document.getElementById("reminder-toast");if(!toast)return;toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(function(){toast.classList.remove("show")},4200)}
function sendHabitReminder(){var message="Time for your Orbit check-in. Keep your streak alive.";if("Notification" in window&&Notification.permission==="granted"){new Notification("Orbit reminder",{body:message,tag:"orbit-reminder"})}showToast(message)}
function updateReminderUI(){var timeEl=document.getElementById("reminder-time");var toggleBtn=document.getElementById("reminder-toggle");var statusEl=document.getElementById("reminder-status");if(!timeEl||!toggleBtn||!statusEl)return;var state=getReminderState();timeEl.value=state.time||"20:00";toggleBtn.textContent=state.enabled?"Disable reminder":"Enable reminder";statusEl.textContent=state.enabled?"Daily reminder set for "+state.time+"." : "Reminder off. Turn it on to get a daily nudge."}
function setupReminder(){var timeEl=document.getElementById("reminder-time");var toggleBtn=document.getElementById("reminder-toggle");if(!timeEl||!toggleBtn)return;updateReminderUI();var reminderCheck=function(){var state=getReminderState();if(!state.enabled||!state.time){return}var now=new Date();var nowMinutes=now.getHours()*60+now.getMinutes();var targetMinutes=Number(state.time.split(":")[0])*60+Number(state.time.split(":")[1]);if(Number.isNaN(targetMinutes))return;if(state.lastNotified===ds(now)&&nowMinutes>=targetMinutes){return}if(nowMinutes===targetMinutes&&now.getSeconds()<5){var nextState=getReminderState();nextState.lastNotified=ds(now);saveReminder(nextState);sendHabitReminder()}};setInterval(reminderCheck,30000);reminderCheck();timeEl.addEventListener("change",function(){var state=getReminderState();state.time=timeEl.value||"20:00";saveReminder(state);updateReminderUI();if(state.enabled){showToast("Reminder updated for "+state.time+".");reminderCheck()}});toggleBtn.addEventListener("click",async function(){if(!("Notification" in window)){showToast("This browser does not support notifications.");return}if(Notification.permission==="default"){var permission=await Notification.requestPermission();if(permission!=="granted"){showToast("Notifications are blocked. In-app reminders still work.");return}}var state=getReminderState();state.enabled=!state.enabled;if(!state.time){state.time="20:00"}saveReminder(state);updateReminderUI();if(state.enabled){showToast("Daily reminder enabled for "+state.time+".");}else{showToast("Daily reminder turned off.")};reminderCheck()})}
function ds(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function back(n){var d=new Date();d.setDate(d.getDate()-n);return ds(d)}
function dateForKey(key){return new Date(key+"T00:00:00")}
function scheduled(h,key){return h.days.indexOf(dateForKey(key).getDay())!==-1}
function streak(h){var n=0,i=0,today=back(0);if(scheduled(h,today)&&!h.log[today])i=1;for(;i<3660;i++){var day=back(i);if(!scheduled(h,day))continue;if(!h.log[day])break;n++}return n}
function scheduleLabel(h){if(h.days.length===7)return "Every day";if(h.days.length===5&&[1,2,3,4,5].every(function(day){return h.days.indexOf(day)!==-1}))return "Weekdays";return h.days.slice().sort().map(function(day){return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day]}).join(", ")}
function formatDuration(ms){
  var totalSeconds=Math.max(0,Math.floor(ms/1000));
  var hours=Math.floor(totalSeconds/3600),minutes=Math.floor((totalSeconds%3600)/60),seconds=totalSeconds%60;
  return (hours?hours+":" : "") + String(minutes).padStart(2,"0") + ":" + String(seconds).padStart(2,"0");
}
function getHabitTimerElapsed(h){
  if(!h||!h.durationMinutes)return 0;
  var timer=h.timer||{};
  var elapsedMs=Number(timer.elapsedMs)||0;
  if(timer.running&&Number.isFinite(timer.startedAt))elapsedMs+=Date.now()-timer.startedAt;
  if(elapsedMs<0)elapsedMs=0;
  return Math.min(elapsedMs,h.durationMinutes*60000);
}
function completeHabitTimer(h,idx){
  if(!h||!h.durationMinutes)return false;
  var durationMs=h.durationMinutes*60000;
  var t=back(0);
  h.timer={running:false,startedAt:null,elapsedMs:durationMs};
  h.log[t]=1;
  save();
  if(typeof idx==="number"){
    var habitButton=document.querySelector('[data-timer-habit="'+idx+'"]');
    if(habitButton)habitButton.focus();
  }
  var message="Great job! You completed "+h.name+". You showed up and followed through—celebrate that progress!";
  if("Notification" in window&&Notification.permission==="granted"){new Notification("Orbit timer complete",{body:message,tag:"orbit-timer-complete"})}
  showToast(message);
  return true;
}
function fortnightRate(h){var count=0,total=0;for(var i=0;i<14;i++){var day=back(i);if(scheduled(h,day)){total++;if(h.log[day])count++}}return total?Math.round(count/total*100):0}
function esc(s){s=asText(s);return s.replace(/[&<>\"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function arc(a0,a1){var r=46,c=60,p=function(a){a=a*Math.PI/180;return(c+r*Math.cos(a)).toFixed(2)+" "+(c+r*Math.sin(a)).toFixed(2)};return"M"+p(a0)+" A"+r+" "+r+" 0 0 1 "+p(a1)}
function getReviewWeekStart(){
  var start=new Date();
  start.setHours(0,0,0,0);
  start.setDate(start.getDate()-((start.getDay()+6)%7)+(reviewWeekOffset*7));
  return start;
}
function renderWeeklyReview(){
  var range=document.getElementById("review-range"),summary=document.getElementById("review-summary");
  if(!range||!summary)return;
  var start=getReviewWeekStart(),end=new Date(start);
  end.setDate(end.getDate()+6);
  var startKey=ds(start),review=weeklyReviews[startKey]||{reflection:"",priorities:""};
  var dateFormat={month:"short",day:"numeric"};
  range.textContent=start.toLocaleDateString(undefined,dateFormat)+" – "+end.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  var nextButton=document.getElementById("review-next");
  if(nextButton)nextButton.disabled=reviewWeekOffset>=0;
  var weekTasks=[];
  var plannedHabits=0,completedHabits=0,focusSessions=0;
  for(var i=0;i<7;i++){
    var date=new Date(start);
    date.setDate(date.getDate()+i);
    var key=ds(date);
    weekTasks=weekTasks.concat(tasksByDate[key]||[]);
    habits.forEach(function(habit){
      if(scheduled(habit,key)){
        plannedHabits++;
        if(habit.log[key])completedHabits++;
      }
    });
    focusSessions+=focusState.focusHistory[key]||0;
  }
  var milestones=goals.reduce(function(total,goal){return total+goal.milestones.length},0);
  var completedMilestones=goals.reduce(function(total,goal){return total+goal.milestones.filter(function(milestone){return milestone.completed}).length},0);
  var completedTasks=weekTasks.filter(function(task){return task.completed}).length;
  summary.innerHTML=
    '<article class="review-stat"><span>Study tasks</span><strong>'+completedTasks+' / '+weekTasks.length+'</strong><small>completed this week</small></article>'+
    '<article class="review-stat"><span>Habit check-ins</span><strong>'+(plannedHabits?Math.round(completedHabits/plannedHabits*100)+'%':'—')+'</strong><small>'+completedHabits+' of '+plannedHabits+' scheduled</small></article>'+
    '<article class="review-stat"><span>Focus sessions</span><strong>'+focusSessions+'</strong><small>tracked sessions this week</small></article>'+
    '<article class="review-stat"><span>Goal milestones</span><strong>'+completedMilestones+' / '+milestones+'</strong><small>complete right now</small></article>';
  var historyNote=document.getElementById("review-history-note");
  if(historyNote)historyNote.textContent="Focus-session history starts now; sessions completed before this update cannot be recovered.";
  if(reviewDisplayedWeekKey!==startKey){
    document.getElementById("review-reflection").value=review.reflection;
    document.getElementById("review-priorities").value=review.priorities;
    reviewDisplayedWeekKey=startKey;
    var changedWeekStatus=document.getElementById("review-status");
    if(changedWeekStatus)changedWeekStatus.textContent="";
  }
}
function setupWeeklyReview(){
  var form=document.getElementById("review-form"),previous=document.getElementById("review-previous"),next=document.getElementById("review-next");
  if(!form||!previous||!next)return;
  previous.addEventListener("click",function(){reviewWeekOffset--;renderWeeklyReview()});
  next.addEventListener("click",function(){if(reviewWeekOffset<0){reviewWeekOffset++;renderWeeklyReview()}});
  form.addEventListener("submit",function(event){
    event.preventDefault();
    var startKey=ds(getReviewWeekStart()),nextReviews=sanitizeWeeklyReviews(weeklyReviews);
    nextReviews[startKey]={
      reflection:document.getElementById("review-reflection").value.trim().slice(0,600),
      priorities:document.getElementById("review-priorities").value.trim().slice(0,600)
    };
    try{
      localStorage.setItem(REVIEWS_KEY,JSON.stringify(nextReviews));
      weeklyReviews=nextReviews;
      document.getElementById("review-status").textContent="Your private review is saved on this device.";
    }catch(error){
      console.error("Unable to save the weekly review.",error);
      document.getElementById("review-status").textContent="Could not save your review. Check this browser's storage settings and try again.";
    }
  });
  renderWeeklyReview();
}
function render(){
  habits=habits.map(normalizeHabit).filter(Boolean);
  var t=back(0),due=habits.filter(function(h){return scheduled(h,t)}),done=due.filter(function(h){return h.log[t]}).length;
  renderTodayTasks();
  document.getElementById("today-date").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  document.getElementById("habit-count").textContent=habits.length+" "+(habits.length===1?"habit":"habits");
  var profile=readProfile();
  if(profile){document.getElementById("sub").textContent="Welcome, "+profile.name+". "+(due.length===0?"Today is a rest day for all your habits.":done===due.length?"All "+done+" habits closed today. Nice loop.":done+" of "+due.length+" due habits closed today. Tap a ring's center to check in.");}
  else document.getElementById("sub").textContent="Every habit is a small orbit. Add one to start.";
  var st=document.getElementById("stats");
  if(habits.length){
    var n=habits.length,pct=due.length?Math.round(done/due.length*100):100,tot=0,scheduledTotal=0,best=0,cols="",chartDescription=[];
    for(var k=13;k>=0;k--){
      var dk=back(k),date=dateForKey(dk),scheduledHabits=habits.filter(function(h){return scheduled(h,dk)}),c=scheduledHabits.filter(function(h){return h.log[dk]}).length,scheduledCount=scheduledHabits.length;
      var dayLabel=date.toLocaleDateString(undefined,{weekday:"short"}),dateLabel=String(date.getDate());
      tot+=c;
      scheduledTotal+=scheduledCount;
      chartDescription.push(date.toLocaleDateString(undefined,{month:"short",day:"numeric"})+": "+c+" of "+scheduledCount+" scheduled habits");
      cols+='<div class="chart-column" title="'+dk+': '+(scheduledCount?c+" of "+scheduledCount+" scheduled":"rest day")+'"><div class="chart-track"><i class="'+(c?"f":"")+(k==0?" t":"")+(scheduledCount?"":" rest")+'" style="height:'+Math.max(scheduledCount?c/scheduledCount*100:0,3)+'%"></i></div><span class="chart-day">'+esc(dayLabel)+'</span><span class="chart-date">'+dateLabel+'</span></div>';
    }
    habits.forEach(function(h){best=Math.max(best,streak(h))});
    var C=2*Math.PI*42;
    st.className="show";
    st.innerHTML='<div class="stats-overview"><div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+(C*(1-pct/100)).toFixed(1)+'"/></svg><b>'+pct+'%</b></div><div class="nums"><div><b>'+done+'/'+due.length+'</b>due today</div><div><b>'+best+'</b>best streak</div><div><b>'+Math.round(tot/(scheduledTotal||1)*100)+'%</b>14-day rate</div></div></div><section class="analytics" aria-labelledby="analytics-title"><div class="chart-heading"><div><p class="chart-kicker">LAST 14 DAYS</p><h2 id="analytics-title">Habit activity</h2></div><p class="chart-total"><b>'+tot+'</b><span>check-ins</span></p></div><div class="chart-wrap"><div class="chart-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div><div class="analytics-chart" role="img" aria-label="Habit completions in the last 14 days. '+esc(chartDescription.join("; "))+'.">'+cols+'</div></div><p class="chart-caption">Each bar shows the share of scheduled habits completed that day.</p></section>';
  }else{
    st.className="show empty-progress";
    st.innerHTML='<p>Add your first habit and start checking in to see your progress here.</p>';
  }
  renderWeeklyReview();
  var el=document.getElementById("list");
  if(!habits.length){el.innerHTML='<div class="empty"><b>Your first habit starts here.</b><span>Add one small thing you want to do regularly.</span></div>';return}
  habits.forEach(function(h){
    if(!h.durationMinutes||!h.timer||!h.timer.running)return;
    var elapsed=getHabitTimerElapsed(h),target=h.durationMinutes*60000;
    if(elapsed>=target){completeHabitTimer(h);}
  });
  el.innerHTML=habits.map(function(h,i){
    var c=COL[i%COL.length],seg="",step=360/14,dueToday=scheduled(h,t),notePreview=h.note?('<div class="habit-note">'+esc(h.note.length>90?h.note.slice(0,87)+"…":h.note)+'</div>'):"",durationMinutes=h.durationMinutes,totalMs=durationMinutes?durationMinutes*60000:0,timerElapsed=durationMinutes?getHabitTimerElapsed(h):0,timerDisplay=durationMinutes?'<div class="habit-timer'+(timerElapsed>=totalMs?' complete':'')+'"><div class="timer-header"><span>Timer</span><strong>'+formatDuration(timerElapsed)+' / '+formatDuration(totalMs)+'</strong></div><div class="timer-controls"><button data-timer-action="'+(h.timer&&h.timer.running?'stop':'start')+'" data-timer-habit="'+i+'" class="timer-btn">'+(h.timer&&h.timer.running?'Stop':'Start')+'</button><button data-timer-action="reset" data-timer-habit="'+i+'" class="timer-btn secondary-timer-btn">Reset</button></div></div>':"";
    for(var k=13;k>=0;k--){var d=back(k),j=13-k,a=-90+j*step;seg+='<path d="'+arc(a+3,a+step-3)+'" class="'+(h.log[d]?"on":"")+(k==0?" now":"")+(scheduled(h,d)?"":" rest")+'" data-i="'+i+'" data-d="'+d+'"><title>'+d+(scheduled(h,d)?"":" (rest day)")+'</title></path>'}
    var dn=h.log[t];
    return '<div class="habit" style="--c:'+c+'"><div class="dial"><svg viewBox="0 0 120 120" role="group" aria-label="Last 14 days">'+seg+'</svg><button class="core'+(dn?" done":"")+(lastPop===i?" pop":"")+(dueToday?"":" rest-day")+'" data-i="'+i+'" data-d="'+t+'" aria-label="'+(dueToday?(dn?"Undo":"Check in"):"Rest day")+': '+esc(h.name)+'" '+(dueToday?"":"disabled")+'><b>'+streak(h)+'</b><small>'+(dueToday?"day streak":"rest day")+'</small></button></div><div class="name">'+esc(h.name)+'</div><div class="habit-schedule">'+esc(scheduleLabel(h))+'</div>'+notePreview+timerDisplay+'<div class="hint"><span>'+fortnightRate(h)+'% this fortnight</span><div class="habit-actions"><button class="note" data-note="'+i+'" aria-label="Add note for '+esc(h.name)+'">Note</button><button class="schedule" data-schedule="'+i+'" aria-label="Change schedule for '+esc(h.name)+'">Schedule</button><button class="edit" data-edit="'+i+'" aria-label="Rename '+esc(h.name)+'">Rename</button><button class="del" data-del="'+i+'" aria-label="Delete '+esc(h.name)+'">Delete</button></div></div></div>'
  }).join("");
  lastPop=null;
}
function renderTodayTasks(){
  var list=document.getElementById("task-list"),count=document.getElementById("task-count"),summary=document.getElementById("task-plan-summary");
  if(!list||!count||!summary)return;
  renderGoals();
  renderWeeklyPlanner();
  var tasks=getTodayTasks(),remaining=tasks.filter(function(task){return !task.completed}).length;
  count.textContent=remaining+" left · "+(tasks.length-remaining)+" done";
  var plannedMinutes=tasks.reduce(function(total,task){return total+task.estimateMinutes},0);
  var remainingMinutes=tasks.reduce(function(total,task){return total+(task.completed?0:task.estimateMinutes)},0);
  summary.textContent="Planned "+formatPlannedTime(plannedMinutes)+" · "+formatPlannedTime(remainingMinutes)+" left to study";
  syncFocusTaskOptions(tasks);
  if(!tasks.length){list.innerHTML='<li class="task-empty">Nothing on your list yet. Add an assignment or one small thing to focus on today.</li>';return}
  var ordered=tasks.map(function(task,index){return {task:task,index:index}}).sort(function(a,b){
    if(a.task.completed!==b.task.completed)return a.task.completed?1:-1;
    var priorityOrder={high:0,medium:1,low:2};
    if(priorityOrder[a.task.priority]!==priorityOrder[b.task.priority])return priorityOrder[a.task.priority]-priorityOrder[b.task.priority];
    if(a.task.dueTime&&b.task.dueTime)return a.task.dueTime.localeCompare(b.task.dueTime);
    if(a.task.dueTime)return -1;
    if(b.task.dueTime)return 1;
    return a.index-b.index;
  });
  list.innerHTML=ordered.map(function(entry){
    var task=entry.task,index=entry.index;
    var subtaskDone=task.subtasks.filter(function(subtask){return subtask.completed}).length;
    var linkedMilestone=findMilestone(task.milestoneId);
    var subtasksHtml='<details class="task-subtasks"><summary>Steps · '+subtaskDone+'/'+task.subtasks.length+'</summary><ul>'+task.subtasks.map(function(subtask,subtaskIndex){return '<li class="'+(subtask.completed?'completed':'')+'"><input type="checkbox" data-subtask-toggle="'+index+'" data-subtask-index="'+subtaskIndex+'" aria-label="Mark step '+esc(subtask.title)+' '+(subtask.completed?'not complete':'complete')+'" '+(subtask.completed?'checked':'')+'><span>'+esc(subtask.title)+'</span><button type="button" data-subtask-delete="'+index+'" data-subtask-index="'+subtaskIndex+'" aria-label="Remove step '+esc(subtask.title)+'">×</button></li>'}).join("")+'</ul><form class="subtask-form" data-subtask-form="'+index+'"><label class="sr-only" for="subtask-'+index+'">Add a step to '+esc(task.title)+'</label><input id="subtask-'+index+'" name="subtask" maxlength="120" placeholder="Add a small step" required '+(task.subtasks.length>=40?'disabled':'')+'><button type="submit" '+(task.subtasks.length>=40?'disabled':'')+'>Add step</button></form></details>';
    var goalBadge=linkedMilestone?'<span class="task-goal-badge">'+esc(linkedMilestone.goal.title)+' · '+esc(linkedMilestone.milestone.title)+'</span>':"";
    return '<li class="task-row priority-'+task.priority+(task.completed?' completed':'')+'"><input type="checkbox" data-task-toggle="'+index+'" aria-label="Mark '+esc(task.title)+' '+(task.completed?'not complete':'complete')+'" '+(task.completed?'checked':'')+'><span class="task-title">'+esc(task.title)+'</span><span class="task-priority">'+task.priority+'</span><span class="task-estimate">'+formatPlannedTime(task.estimateMinutes)+'</span>'+(task.dueTime?'<time class="task-due" datetime="'+task.dueTime+'">Due '+task.dueTime+'</time>':'')+'<button class="task-delete" type="button" data-task-delete="'+index+'" aria-label="Delete '+esc(task.title)+'">Remove</button>'+goalBadge+subtasksHtml+'</li>';
  }).join("");
}
function formatPlannedTime(totalMinutes){
  var hours=Math.floor(totalMinutes/60),minutes=totalMinutes%60;
  if(hours&&minutes)return hours+"h "+minutes+"m";
  if(hours)return hours+"h";
  return minutes+"m";
}
function updateMilestoneOptions(){
  var select=document.getElementById("task-milestone");
  if(!select)return;
  var selected=select.value,options=['<option value="">No milestone</option>'];
  goals.forEach(function(goal){
    goal.milestones.forEach(function(milestone){
      options.push('<option value="'+milestone.id+'">'+esc(goal.title)+' · '+esc(milestone.title)+(milestone.completed?' (done)':'')+'</option>');
    });
  });
  select.innerHTML=options.join("");
  if(findMilestone(selected))select.value=selected;
}
function saveGoalsAndTasks(nextGoals,nextTasks){
  var normalizedGoals=sanitizeGoals(nextGoals),normalizedTasks=sanitizeTaskMap(nextTasks),oldGoals=localStorage.getItem(GOALS_KEY),oldTasks=localStorage.getItem(TASKS_KEY);
  try{
    localStorage.setItem(TASKS_KEY,JSON.stringify(normalizedTasks));
    localStorage.setItem(GOALS_KEY,JSON.stringify(normalizedGoals));
  }catch(error){
    try{if(oldTasks===null)localStorage.removeItem(TASKS_KEY);else localStorage.setItem(TASKS_KEY,oldTasks)}catch(rollbackError){console.error("Unable to roll back task links after a goal update.",rollbackError)}
    try{if(oldGoals===null)localStorage.removeItem(GOALS_KEY);else localStorage.setItem(GOALS_KEY,oldGoals)}catch(rollbackError){console.error("Unable to roll back goals after a goal update.",rollbackError)}
    console.error("Unable to save goal and task changes.",error);
    var status=document.getElementById("goal-status");if(status)status.textContent="Could not save this goal change. Check this browser's storage settings and try again.";
    return false;
  }
  goals=normalizedGoals;
  tasksByDate=normalizedTasks;
  updateMilestoneOptions();
  renderTodayTasks();
  return true;
}
function renderGoals(){
  var list=document.getElementById("goal-list"),count=document.getElementById("goals-count");
  if(!list||!count)return;
  count.textContent=goals.length+" "+(goals.length===1?"goal":"goals");
  if(!goals.length){list.innerHTML='<p class="goal-empty">No goals yet. Choose something meaningful to work toward and break it into small milestones.</p>';return}
  var today=ds(new Date());
  list.innerHTML=goals.map(function(goal,goalIndex){
    var completed=goal.milestones.filter(function(milestone){return milestone.completed}).length;
    var percent=goal.milestones.length?Math.round(completed/goal.milestones.length*100):0;
    var isComplete=goal.milestones.length>0&&completed===goal.milestones.length;
    var isOverdue=goal.targetDate<today&&!isComplete;
    var targetLabel=dateForKey(goal.targetDate).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
    var milestoneList=goal.milestones.length?'<ul class="milestone-list">'+goal.milestones.map(function(milestone,milestoneIndex){
      var linkedTasks=[];
      Object.keys(tasksByDate).sort().forEach(function(dateKey){
        (tasksByDate[dateKey]||[]).forEach(function(task){if(task.milestoneId===milestone.id)linkedTasks.push({date:dateKey,task:task})});
      });
      var linkedHtml=linkedTasks.length?'<details class="milestone-linked"><summary>'+linkedTasks.length+' linked task'+(linkedTasks.length===1?"":"s")+'</summary><ul>'+linkedTasks.map(function(entry){return '<li class="'+(entry.task.completed?'completed':'')+'"><span>'+esc(entry.task.title)+'</span><time datetime="'+entry.date+'">'+esc(dateForKey(entry.date).toLocaleDateString(undefined,{month:"short",day:"numeric"}))+'</time></li>'}).join("")+'</ul></details>':"";
      return '<li class="milestone-item'+(milestone.completed?' completed':'')+'"><input type="checkbox" data-milestone-toggle="'+goalIndex+'" data-milestone-index="'+milestoneIndex+'" aria-label="Mark milestone '+esc(milestone.title)+' '+(milestone.completed?'not complete':'complete')+'" '+(milestone.completed?'checked':'')+'><div class="milestone-copy"><span class="milestone-title">'+esc(milestone.title)+'</span>'+linkedHtml+'</div><button type="button" class="milestone-delete" data-milestone-delete="'+goalIndex+'" data-milestone-index="'+milestoneIndex+'" aria-label="Remove milestone '+esc(milestone.title)+'">×</button></li>';
    }).join("")+'</ul>':'<p class="milestone-empty">Add a few milestones to make this goal easier to reach.</p>';
    var addForm='<form class="milestone-form" data-milestone-form="'+goalIndex+'"><label class="sr-only" for="milestone-title-'+goal.id+'">Add a milestone to '+esc(goal.title)+'</label><input id="milestone-title-'+goal.id+'" name="milestone" maxlength="120" placeholder="e.g. Review chapters 1–3" required '+(goal.milestones.length>=40?'disabled':'')+'><button type="submit" '+(goal.milestones.length>=40?'disabled':'')+'>Add milestone</button></form>';
    return '<article class="goal-card'+(isComplete?' is-complete':'')+(isOverdue?' is-overdue':'')+'"><div class="goal-card-heading"><div><p class="goal-target'+(isOverdue?' overdue':'')+'">'+(isComplete?'GOAL COMPLETE':isOverdue?'PAST TARGET':'TARGET DATE')+' · '+esc(targetLabel)+'</p><h3>'+esc(goal.title)+'</h3></div><button type="button" class="goal-delete" data-goal-delete="'+goalIndex+'" aria-label="Delete goal '+esc(goal.title)+'">Remove</button></div><div class="goal-progress-copy"><span>'+completed+' of '+goal.milestones.length+' milestones</span><strong>'+percent+'%</strong></div><progress max="100" value="'+percent+'" aria-label="'+percent+' percent of '+esc(goal.title)+' completed"></progress><p class="goal-encouragement">'+(isComplete?'You reached this goal—take a moment to celebrate your effort!':goal.milestones.length?completed? 'You are making progress. Keep taking one small step at a time.':'Every big achievement starts with one small step.':'A goal becomes easier when you decide the steps.')+'</p>'+milestoneList+addForm+'</article>';
  }).join("");
}
function setupGoals(){
  var form=document.getElementById("goal-form"),titleInput=document.getElementById("goal-title"),dateInput=document.getElementById("goal-date"),list=document.getElementById("goal-list"),taskMilestone=document.getElementById("task-milestone");
  if(!form||!titleInput||!dateInput||!list||!taskMilestone)return;
  dateInput.value=ds(new Date());
  form.addEventListener("submit",function(event){
    event.preventDefault();
    var title=titleInput.value.trim(),targetDate=dateInput.value;
    if(!title){titleInput.focus();return}
    if(!validDateKey(targetDate)){document.getElementById("goal-status").textContent="Choose a valid target date.";dateInput.focus();return}
    if(goals.length>=50){document.getElementById("goal-status").textContent="You can keep up to 50 active goals.";return}
    var nextGoals=goals.concat([{id:createEntryId("g"),title:title.slice(0,120),targetDate:targetDate,milestones:[]}]);
    if(saveGoals(nextGoals)){titleInput.value="";dateInput.value=ds(new Date());document.getElementById("goal-status").textContent="Goal added. Break it into milestones to see your progress.";titleInput.focus()}
  });
  list.addEventListener("submit",function(event){
    var milestoneForm=event.target.closest("[data-milestone-form]");
    if(!milestoneForm)return;
    event.preventDefault();
    var goalIndex=Number(milestoneForm.dataset.milestoneForm),goal=goals[goalIndex],input=milestoneForm.querySelector('input[name="milestone"]'),title=input.value.trim();
    if(!goal||!title)return;
    if(goal.milestones.length>=40){document.getElementById("goal-status").textContent="Each goal can have up to 40 milestones.";return}
    var nextGoals=goals.slice();
    nextGoals[goalIndex]=Object.assign({},goal,{milestones:goal.milestones.concat([{id:createEntryId("m"),title:title.slice(0,120),completed:false}])});
    if(saveGoals(nextGoals)){document.getElementById("goal-status").textContent="Milestone added.";var nextForm=list.querySelector('[data-milestone-form="'+goalIndex+'"]');if(nextForm)nextForm.querySelector('input[name="milestone"]').focus()}
  });
  list.addEventListener("change",function(event){
    var checkbox=event.target.closest("[data-milestone-toggle]");
    if(!checkbox)return;
    var goalIndex=Number(checkbox.dataset.milestoneToggle),milestoneIndex=Number(checkbox.dataset.milestoneIndex),goal=goals[goalIndex];
    if(!goal||!goal.milestones[milestoneIndex])return;
    var nextGoals=goals.slice(),milestones=goal.milestones.slice();
    milestones[milestoneIndex]=Object.assign({},milestones[milestoneIndex],{completed:checkbox.checked});
    nextGoals[goalIndex]=Object.assign({},goal,{milestones:milestones});
    if(saveGoals(nextGoals)){
      document.getElementById("goal-status").textContent=checkbox.checked?"Milestone complete—great progress!":"Milestone reopened.";
      if(checkbox.checked)showToast("Milestone complete! You are one step closer to your goal.");
      var next=list.querySelector('[data-milestone-toggle="'+goalIndex+'"][data-milestone-index="'+milestoneIndex+'"]');if(next)next.focus();
    }
  });
  list.addEventListener("click",function(event){
    var milestoneDelete=event.target.closest("[data-milestone-delete]"),goalDelete=event.target.closest("[data-goal-delete]");
    if(!milestoneDelete&&!goalDelete)return;
    var deletingGoal=!!goalDelete,index=Number((goalDelete||milestoneDelete).dataset[deletingGoal?"goalDelete":"milestoneDelete"]),goal=goals[index];
    if(!goal)return;
    if(deletingGoal&&!window.confirm("Delete this goal and its milestones? Linked study tasks will stay on your list but become unlinked."))return;
    var nextGoals=goals.slice(),nextTasks=Object.assign({},tasksByDate);
    if(deletingGoal){
      var milestoneIds=goal.milestones.map(function(milestone){return milestone.id});
      nextGoals.splice(index,1);
      Object.keys(nextTasks).forEach(function(dateKey){nextTasks[dateKey]=nextTasks[dateKey].map(function(task){return milestoneIds.indexOf(task.milestoneId)!==-1?Object.assign({},task,{milestoneId:""}):task})});
    }else{
      var milestoneIndex=Number(milestoneDelete.dataset.milestoneIndex),milestone=goal.milestones[milestoneIndex];
      if(!milestone)return;
      nextGoals[index]=Object.assign({},goal,{milestones:goal.milestones.filter(function(_,i){return i!==milestoneIndex})});
      Object.keys(nextTasks).forEach(function(dateKey){nextTasks[dateKey]=nextTasks[dateKey].map(function(task){return task.milestoneId===milestone.id?Object.assign({},task,{milestoneId:""}):task})});
    }
    if(saveGoalsAndTasks(nextGoals,nextTasks)){
      document.getElementById("goal-status").textContent=deletingGoal?"Goal deleted. Its study tasks are still on your list.":"Milestone removed. Its study tasks are still on your list.";
    }
  });
  updateMilestoneOptions();
  renderGoals();
}
function shiftDate(date,days){var shifted=new Date(date.getFullYear(),date.getMonth(),date.getDate());shifted.setDate(shifted.getDate()+days);return shifted}
function plannerWeekStart(){
  var today=new Date(),monday=shiftDate(today,-((today.getDay()+6)%7));
  monday.setDate(monday.getDate()+plannerWeekOffset*7);
  return monday;
}
function updatePlannerWeekForDate(dateKey){
  if(!validDateKey(dateKey))return;
  var selected=dateForKey(dateKey),currentMonday=shiftDate(new Date(),-((new Date().getDay()+6)%7));
  var selectedUtc=Date.UTC(selected.getFullYear(),selected.getMonth(),selected.getDate());
  var mondayUtc=Date.UTC(currentMonday.getFullYear(),currentMonday.getMonth(),currentMonday.getDate());
  plannerWeekOffset=Math.floor((selectedUtc-mondayUtc)/604800000);
}
function renderWeeklyPlanner(){
  var daysContainer=document.getElementById("week-days"),range=document.getElementById("week-range"),summary=document.getElementById("weekly-planner-summary");
  if(!daysContainer||!range||!summary)return;
  var weekStart=plannerWeekStart(),todayKey=ds(new Date()),weekTasks=[],totalMinutes=0,remainingMinutes=0,unfinished=0;
  var firstLabel=weekStart.toLocaleDateString(undefined,{month:"short",day:"numeric"}),lastDay=shiftDate(weekStart,6),lastLabel=lastDay.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  range.textContent=firstLabel+" – "+lastLabel;
  daysContainer.innerHTML=Array.from({length:7},function(_,dayIndex){
    var date=shiftDate(weekStart,dayIndex),dateKey=ds(date),tasks=tasksByDate[dateKey]||[];
    weekTasks=weekTasks.concat(tasks);
    var dayTotal=tasks.reduce(function(total,task){return total+task.estimateMinutes},0);
    var dayRemaining=tasks.reduce(function(total,task){return total+(task.completed?0:task.estimateMinutes)},0);
    totalMinutes+=dayTotal;
    remainingMinutes+=dayRemaining;
    unfinished+=tasks.filter(function(task){return !task.completed}).length;
    var ordered=tasks.map(function(task,index){return {task:task,index:index}}).sort(function(a,b){
      if(a.task.completed!==b.task.completed)return a.task.completed?1:-1;
      var priorityOrder={high:0,medium:1,low:2};
      if(priorityOrder[a.task.priority]!==priorityOrder[b.task.priority])return priorityOrder[a.task.priority]-priorityOrder[b.task.priority];
      if(a.task.dueTime&&b.task.dueTime)return a.task.dueTime.localeCompare(b.task.dueTime);
      if(a.task.dueTime)return -1;
      if(b.task.dueTime)return 1;
      return a.index-b.index;
    });
    var taskItems=ordered.map(function(entry){
      var task=entry.task,index=entry.index,stepCount=task.subtasks.length,stepDone=task.subtasks.filter(function(step){return step.completed}).length,linkedMilestone=findMilestone(task.milestoneId);
      var goalBadge=linkedMilestone?'<span class="weekly-task-goal">'+esc(linkedMilestone.goal.title)+' · '+esc(linkedMilestone.milestone.title)+'</span>':"";
      var due=task.dueTime?'<time datetime="'+task.dueTime+'">Due '+task.dueTime+'</time>':"";
      var steps='<details class="weekly-task-steps"><summary>Steps · '+stepDone+'/'+stepCount+'</summary><ul>'+task.subtasks.map(function(step,stepIndex){return '<li class="'+(step.completed?'completed':'')+'"><input type="checkbox" data-week-subtask-toggle="'+index+'" data-week-subtask-index="'+stepIndex+'" data-week-task-date="'+dateKey+'" aria-label="Mark step '+esc(step.title)+' '+(step.completed?'not complete':'complete')+'" '+(step.completed?'checked':'')+'><span>'+esc(step.title)+'</span><button type="button" data-week-subtask-delete="'+index+'" data-week-subtask-index="'+stepIndex+'" data-week-task-date="'+dateKey+'" aria-label="Remove step '+esc(step.title)+'">×</button></li>'}).join("")+'</ul><form class="subtask-form" data-week-subtask-form="'+index+'" data-week-task-date="'+dateKey+'"><label class="sr-only" for="week-step-'+dateKey+'-'+index+'">Add a step to '+esc(task.title)+'</label><input id="week-step-'+dateKey+'-'+index+'" name="subtask" maxlength="120" placeholder="Add a small step" required '+(stepCount>=40?'disabled':'')+'><button type="submit" '+(stepCount>=40?'disabled':'')+'>Add step</button></form></details>';
      return '<li class="weekly-task'+(task.completed?' completed':'')+'"><input type="checkbox" data-week-task-toggle="'+index+'" data-week-task-date="'+dateKey+'" aria-label="Mark '+esc(task.title)+' '+(task.completed?'not complete':'complete')+'" '+(task.completed?'checked':'')+'><div class="weekly-task-copy"><span class="weekly-task-title">'+esc(task.title)+'</span><span class="weekly-task-meta"><span class="task-priority priority-'+task.priority+'">'+task.priority+'</span><span>'+formatPlannedTime(task.estimateMinutes)+'</span>'+due+'</span>'+goalBadge+steps+'</div><button type="button" class="weekly-task-delete" data-week-task-delete="'+index+'" data-week-task-date="'+dateKey+'" aria-label="Remove '+esc(task.title)+'">×</button></li>';
    }).join("");
    var daySummary=tasks.length?'<span>'+tasks.length+' task'+(tasks.length===1?"":"s")+'</span><span>'+formatPlannedTime(dayTotal)+' planned</span><span>'+formatPlannedTime(dayRemaining)+' left</span>':'<span>Free</span><span>0m planned</span>';
    return '<section class="week-day'+(dateKey===todayKey?' is-today':'')+'" aria-label="'+date.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})+'"><div class="week-day-heading"><div><h4>'+esc(date.toLocaleDateString(undefined,{weekday:"long"}))+(dateKey===todayKey?' <span>Today</span>':"")+'</h4><p>'+esc(date.toLocaleDateString(undefined,{month:"short",day:"numeric"}))+'</p></div></div><div class="week-day-total">'+daySummary+'</div>'+(tasks.length?'<ul class="weekly-task-list">'+taskItems+'</ul>':'<p class="week-day-empty">Nothing planned yet.</p>')+'<button type="button" class="week-add-task" data-plan-date="'+dateKey+'">+ Add task</button></section>';
  }).join("");
  summary.textContent=weekTasks.length+" task"+(weekTasks.length===1?"":"s")+" · "+formatPlannedTime(totalMinutes)+" planned · "+formatPlannedTime(remainingMinutes)+" left to study";
}
function syncFocusTaskOptions(tasks){
  var select=document.getElementById("focus-task");
  if(!select)return;
  var state=getFocusState(),previousTitle=state.taskTitle;
  select.innerHTML='<option value="">Choose a task or focus freely</option>'+tasks.map(function(task,index){return '<option value="'+index+'">'+esc(task.title)+(task.completed?' (done)':'')+'</option>'}).join("");
  var selectedIndex=tasks.findIndex(function(task){return task.title===previousTitle});
  select.value=selectedIndex<0?"":String(selectedIndex);
  if(selectedIndex<0&&previousTitle){
    select.insertAdjacentHTML("beforeend",'<option value="previous" selected>'+esc(previousTitle)+' (task no longer on today&apos;s list)</option>');
    select.value="previous";
  }
}
function focusRemainingMs(state){
  if(state.status!=="running"||!Number.isFinite(state.startedAt))return state.remainingMs;
  return Math.max(0,state.remainingMs-(Date.now()-state.startedAt));
}
function renderFocusTimer(){
  var state=getFocusState(),remaining=focusRemainingMs(state),isBreak=state.phase==="break";
  var phase=document.getElementById("focus-phase"),clock=document.getElementById("focus-countdown"),status=document.getElementById("focus-status");
  var toggle=document.getElementById("focus-toggle"),breakButton=document.getElementById("focus-break"),reset=document.getElementById("focus-reset"),sessions=document.getElementById("focus-sessions");
  if(!phase||!clock||!status||!toggle||!breakButton||!reset||!sessions)return;
  phase.textContent=isBreak?"BREAK":"FOCUS";
  clock.textContent=formatDuration(remaining);
  clock.setAttribute("datetime","PT"+Math.ceil(remaining/1000)+"S");
  sessions.textContent=state.completedSessions+" "+(state.completedSessions===1?"session":"sessions")+" today";
  if(state.status==="running")status.textContent=isBreak?"Take a real breather. Your next focus block will be here when you're ready.":"One thing at a time. Focus on "+(state.taskTitle||"your studies")+".";
  else if(state.status==="paused")status.textContent="Session paused. Resume when you are ready.";
  else if(state.status==="focus-done")status.textContent="Focus block complete! You made progress. Take a short break before your next block.";
  else if(state.status==="break-done")status.textContent="Break complete. Take a breath, then start your next focus block.";
  else status.textContent=isBreak?"Break ready when you need one.":"Choose a task and start one focused block.";
  toggle.textContent=state.status==="running"?"Pause":state.status==="paused"?"Resume":state.status==="focus-done"?"Start next focus":state.status==="break-done"?"Start focus":isBreak?"Start break":"Start focus";
  breakButton.hidden=state.status!=="focus-done";
  var focusHoursInput=document.getElementById("focus-hours"),focusInput=document.getElementById("focus-minutes"),breakInput=document.getElementById("break-minutes");
  if(document.activeElement!==focusHoursInput&&document.activeElement!==focusInput){
    focusHoursInput.value=Math.floor(state.focusMinutes/60);
    focusInput.value=state.focusMinutes%60;
  }
  if(document.activeElement!==breakInput)breakInput.value=state.breakMinutes;
  focusHoursInput.disabled=state.status==="running";
  focusInput.disabled=state.status==="running";
  breakInput.disabled=state.status==="running";
  reset.disabled=state.status==="ready"&&state.phase==="focus"&&remaining===state.focusMinutes*60000;
}
function finishFocusPhase(){
  var state=getFocusState(),wasBreak=state.phase==="break";
  state.status=wasBreak?"break-done":"focus-done";
  state.remainingMs=0;
  state.startedAt=null;
  if(!wasBreak){
    state.completedDate=ds(new Date());
    state.completedSessions++;
    state.focusHistory[state.completedDate]=(state.focusHistory[state.completedDate]||0)+1;
  }
  saveFocusState();
  renderFocusTimer();
  renderWeeklyReview();
  notifyFocus(wasBreak?"Break's over. Great job taking time to recharge—ready for your next focus block?":"Great work! Your focus session is complete. You made progress—take a well-earned short break.");
}
function setupFocusTimer(){
  var toggle=document.getElementById("focus-toggle"),breakButton=document.getElementById("focus-break"),reset=document.getElementById("focus-reset");
  var taskSelect=document.getElementById("focus-task"),focusHoursInput=document.getElementById("focus-hours"),focusInput=document.getElementById("focus-minutes"),breakInput=document.getElementById("break-minutes");
  taskSelect.addEventListener("change",function(){
    var tasks=getTodayTasks(),selected=taskSelect.value;
    focusState.taskTitle=selected===""?"":selected==="previous"?focusState.taskTitle:(tasks[Number(selected)]?tasks[Number(selected)].title:"");
    saveFocusState();
    renderFocusTimer();
  });
  toggle.addEventListener("click",function(){
    var state=getFocusState();
    if(state.status==="running"){
      state.remainingMs=focusRemainingMs(state);
      state.status="paused";
      state.startedAt=null;
    }else{
      if(state.status==="focus-done"||state.status==="break-done"){
        state.phase="focus";
        state.remainingMs=state.focusMinutes*60000;
      }else if(state.remainingMs<=0){
        state.remainingMs=(state.phase==="focus"?state.focusMinutes:state.breakMinutes)*60000;
      }
      state.status="running";
      state.startedAt=Date.now();
    }
    saveFocusState();
    renderFocusTimer();
  });
  breakButton.addEventListener("click",function(){
    var state=getFocusState();
    if(state.status!=="focus-done")return;
    state.phase="break";
    state.status="running";
    state.remainingMs=state.breakMinutes*60000;
    state.startedAt=Date.now();
    saveFocusState();
    renderFocusTimer();
  });
  reset.addEventListener("click",function(){
    var state=getFocusState();
    state.phase="focus";
    state.status="ready";
    state.remainingMs=state.focusMinutes*60000;
    state.startedAt=null;
    saveFocusState();
    renderFocusTimer();
  });
  function updateFocusLength(){
    var hours=Number(focusHoursInput.value),minutes=Number(focusInput.value),state=getFocusState(),totalMinutes=hours*60+minutes;
    if(!Number.isInteger(hours)||hours<0||hours>12||!Number.isInteger(minutes)||minutes<0||minutes>59||totalMinutes<1||totalMinutes>720){
      document.getElementById("focus-status").textContent="Choose a focus length from 1 minute to 12 hours.";
      renderFocusTimer();
      return;
    }
    state.focusMinutes=totalMinutes;
    if(state.phase==="focus"&&state.status!=="running"){state.remainingMs=totalMinutes*60000;state.status="ready";state.startedAt=null}
    saveFocusState();
    renderFocusTimer();
  }
  focusHoursInput.addEventListener("change",updateFocusLength);
  focusInput.addEventListener("change",updateFocusLength);
  breakInput.addEventListener("change",function(){
    var minutes=Number(breakInput.value),state=getFocusState();
    if(!Number.isInteger(minutes)||minutes<1||minutes>60){breakInput.value=state.breakMinutes;document.getElementById("focus-status").textContent="Choose a break length from 1 to 60 minutes.";return}
    state.breakMinutes=minutes;
    if(state.phase==="break"&&state.status!=="running"){state.remainingMs=minutes*60000;state.status="ready";state.startedAt=null}
    saveFocusState();
    renderFocusTimer();
  });
  focusHoursInput.value=Math.floor(focusState.focusMinutes/60);
  focusInput.value=focusState.focusMinutes%60;
  breakInput.value=focusState.breakMinutes;
  syncFocusTaskOptions(getTodayTasks());
  renderFocusTimer();
  setInterval(function(){
    var state=getFocusState();
    var today=ds(new Date());
    if(state.completedDate!==today){state.completedDate=today;state.completedSessions=0;saveFocusState()}
    if(state.status==="running"&&focusRemainingMs(state)<=0)finishFocusPhase();
    else renderFocusTimer();
  },1000);
}
var signinForm=document.getElementById("signin-form");
if(signinForm){
  var savedProfile=readProfile()||{};
  document.getElementById("user-name").value=savedProfile.name||"";
  if(window.matchMedia("(hover: hover) and (pointer: fine)").matches&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    var signinPage=document.body,signinLayout=document.querySelector(".signin-layout"),pointerFrame=0;
    signinPage.addEventListener("pointermove",function(e){
      if(e.pointerType==="touch")return;
      if(pointerFrame)cancelAnimationFrame(pointerFrame);
      pointerFrame=requestAnimationFrame(function(){
        var layoutRect=signinLayout.getBoundingClientRect();
        var x=(e.clientX-layoutRect.left)/layoutRect.width-.5;
        var y=(e.clientY-layoutRect.top)/layoutRect.height-.5;
        signinPage.style.setProperty("--pointer-x",(e.clientX/window.innerWidth*100).toFixed(2)+"%");
        signinPage.style.setProperty("--pointer-y",(e.clientY/window.innerHeight*100).toFixed(2)+"%");
        signinPage.style.setProperty("--scene-x",(x*18).toFixed(2)+"px");
        signinPage.style.setProperty("--scene-y",(y*14).toFixed(2)+"px");
        signinPage.style.setProperty("--planet-x",(x*-24).toFixed(2)+"px");
        signinPage.style.setProperty("--planet-y",(y*-20).toFixed(2)+"px");
        signinPage.style.setProperty("--orbit-x",(x*12).toFixed(2)+"px");
        signinPage.style.setProperty("--orbit-y",(y*10).toFixed(2)+"px");
        signinPage.style.setProperty("--form-tilt-x",(y*-2.2).toFixed(2)+"deg");
        signinPage.style.setProperty("--form-tilt-y",(x*2.2).toFixed(2)+"deg");
      });
    });
    signinPage.addEventListener("pointerleave",function(){
      if(pointerFrame)cancelAnimationFrame(pointerFrame);
      ["--pointer-x","--pointer-y","--scene-x","--scene-y","--planet-x","--planet-y","--orbit-x","--orbit-y","--form-tilt-x","--form-tilt-y"].forEach(function(property){signinPage.style.removeProperty(property)});
    });
  }
  signinForm.addEventListener("submit",function(e){
    e.preventDefault();
    var form=e.currentTarget;
    var profile={name:asText(form.elements.name.value).trim()};
    var error=document.getElementById("form-error");
    if(!profile.name){error.textContent="Please enter your name.";return}
    if(!saveProfile(profile)){error.textContent="Unable to save your profile in this browser. Check your storage settings and try again.";return}
    error.textContent="";
    window.location.href="dashboard.html";
  });
}else{
  var taskForm=document.getElementById("task-form"),taskInput=document.getElementById("task-input"),taskDate=document.getElementById("task-date"),taskTime=document.getElementById("task-time"),taskPriority=document.getElementById("task-priority"),taskEstimate=document.getElementById("task-estimate"),taskMilestone=document.getElementById("task-milestone"),taskList=document.getElementById("task-list"),weekDays=document.getElementById("week-days");
  taskDate.value=ds(new Date());
  taskDate.addEventListener("change",function(){updatePlannerWeekForDate(taskDate.value);renderWeeklyPlanner()});
  document.getElementById("week-previous").addEventListener("click",function(){plannerWeekOffset--;renderWeeklyPlanner()});
  document.getElementById("week-next").addEventListener("click",function(){plannerWeekOffset++;renderWeeklyPlanner()});
  taskForm.addEventListener("submit",function(e){
    e.preventDefault();
    var title=taskInput.value.trim(),estimateMinutes=Number(taskEstimate.value),dateKey=taskDate.value;
    if(!title){taskInput.focus();return}
    if(!validDateKey(dateKey)){document.getElementById("task-status").textContent="Choose a valid date for this task.";taskDate.focus();return}
    if(!Number.isInteger(estimateMinutes)||estimateMinutes<1||estimateMinutes>720){document.getElementById("task-status").textContent="Choose an estimate from 1 to 720 minutes.";taskEstimate.focus();return}
    var tasks=(tasksByDate[dateKey]||[]).slice();
    tasks.push({title:title.slice(0,120),dueTime:taskTime.value,priority:taskPriority.value,estimateMinutes:estimateMinutes,completed:false,milestoneId:taskMilestone.value});
    if(saveTasksForDate(dateKey,tasks)){
      taskInput.value="";
      taskTime.value="";
      taskPriority.value="medium";
      taskEstimate.value="30";
      taskMilestone.value="";
      plannerWeekOffset=0;
      updatePlannerWeekForDate(dateKey);
      document.getElementById("task-status").textContent=dateKey===ds(new Date())?"Task added to today's list.":"Task planned for "+dateForKey(dateKey).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})+".";
      renderTodayTasks();
      taskInput.focus();
    }
  });
  taskList.addEventListener("change",function(e){
    var taskCheckbox=e.target.closest("[data-task-toggle]"),subtaskCheckbox=e.target.closest("[data-subtask-toggle]");
    if(!taskCheckbox&&!subtaskCheckbox)return;
    var tasks=getTodayTasks().slice();
    if(taskCheckbox){
      var taskIndex=+taskCheckbox.dataset.taskToggle;
      if(!tasks[taskIndex])return;
      tasks[taskIndex].completed=taskCheckbox.checked;
      tasks[taskIndex].subtasks.forEach(function(subtask){subtask.completed=taskCheckbox.checked});
      if(saveTodayTasks(tasks)){document.getElementById("task-status").textContent=tasks[taskIndex].completed?"Task and its steps marked complete.":"Task and its steps marked incomplete.";renderTodayTasks();var nextCheckbox=taskList.querySelector('[data-task-toggle="'+taskIndex+'"]');if(nextCheckbox)nextCheckbox.focus()}
      return;
    }
    var parentIndex=+subtaskCheckbox.dataset.subtaskToggle,stepIndex=+subtaskCheckbox.dataset.subtaskIndex,parentTask=tasks[parentIndex];
    if(!parentTask||!parentTask.subtasks[stepIndex])return;
    parentTask.subtasks[stepIndex].completed=subtaskCheckbox.checked;
    parentTask.completed=parentTask.subtasks.length>0&&parentTask.subtasks.every(function(subtask){return subtask.completed});
    if(saveTodayTasks(tasks)){document.getElementById("task-status").textContent=parentTask.completed?"All steps complete. Task finished!":"Step progress saved.";renderTodayTasks();var nextStep=taskList.querySelector('[data-subtask-toggle="'+parentIndex+'"][data-subtask-index="'+stepIndex+'"]');if(nextStep)nextStep.focus()}
  });
  taskList.addEventListener("submit",function(e){
    var form=e.target.closest("[data-subtask-form]");
    if(!form)return;
    e.preventDefault();
    var taskIndex=+form.dataset.subtaskForm,input=form.querySelector('input[name="subtask"]'),title=input.value.trim(),tasks=getTodayTasks().slice();
    if(!tasks[taskIndex]||!title)return;
    if(tasks[taskIndex].subtasks.length>=40){document.getElementById("task-status").textContent="A task can have up to 40 steps.";return}
    tasks[taskIndex].subtasks.push({title:title.slice(0,120),completed:false});
    tasks[taskIndex].completed=false;
    if(saveTodayTasks(tasks)){document.getElementById("task-status").textContent="Step added.";renderTodayTasks();var details=taskList.querySelector('.task-row [data-subtask-form="'+taskIndex+'"]');if(details){details.closest("details").open=true;details.querySelector('input[name="subtask"]').focus()}}
  });
  taskList.addEventListener("click",function(e){
    var button=e.target.closest("[data-task-delete]");
    var subtaskButton=e.target.closest("[data-subtask-delete]");
    if(button){
      var tasks=getTodayTasks().slice(),index=+button.dataset.taskDelete;
      if(index<0||index>=tasks.length)return;
      tasks.splice(index,1);
      if(saveTodayTasks(tasks)){document.getElementById("task-status").textContent="Task removed from today's list.";renderTodayTasks();var nextButton=taskList.querySelector(".task-delete");if(nextButton)nextButton.focus();else taskInput.focus()}
      return;
    }
    if(!subtaskButton)return;
    var tasks=getTodayTasks().slice(),taskIndex=+subtaskButton.dataset.subtaskDelete,stepIndex=+subtaskButton.dataset.subtaskIndex,task=tasks[taskIndex];
    if(!task||!task.subtasks[stepIndex])return;
    task.subtasks.splice(stepIndex,1);
    if(task.subtasks.length)task.completed=task.subtasks.every(function(subtask){return subtask.completed});
    if(saveTodayTasks(tasks)){document.getElementById("task-status").textContent="Step removed.";renderTodayTasks();var details=taskList.querySelector('[data-subtask-form="'+taskIndex+'"]');if(details){details.closest("details").open=true;details.querySelector('input[name="subtask"]').focus()}}
  });
  weekDays.addEventListener("change",function(e){
    var checkbox=e.target.closest("[data-week-task-toggle]"),stepCheckbox=e.target.closest("[data-week-subtask-toggle]");
    if(!checkbox&&!stepCheckbox)return;
    var dateKey=(checkbox||stepCheckbox).dataset.weekTaskDate,tasks=(tasksByDate[dateKey]||[]).slice(),taskIndex=Number(checkbox?checkbox.dataset.weekTaskToggle:stepCheckbox.dataset.weekSubtaskToggle),task=tasks[taskIndex];
    if(!task)return;
    if(checkbox){
      task.completed=checkbox.checked;
      task.subtasks.forEach(function(subtask){subtask.completed=checkbox.checked});
    }else{
      var stepIndex=Number(stepCheckbox.dataset.weekSubtaskIndex),step=task.subtasks[stepIndex];
      if(!step)return;
      step.completed=stepCheckbox.checked;
      task.completed=task.subtasks.length>0&&task.subtasks.every(function(subtask){return subtask.completed});
    }
    if(saveTasksForDate(dateKey,tasks)){
      document.getElementById("task-status").textContent=checkbox?(task.completed?"Task and its steps marked complete.":"Task and its steps marked incomplete."):task.completed?"All steps complete. Task finished!":"Step progress saved.";
      renderTodayTasks();
      var next=weekDays.querySelector('[data-week-task-toggle="'+taskIndex+'"][data-week-task-date="'+dateKey+'"]');
      if(next)next.focus();
    }
  });
  weekDays.addEventListener("click",function(e){
    var addButton=e.target.closest("[data-plan-date]"),removeStepButton=e.target.closest("[data-week-subtask-delete]"),removeButton=e.target.closest("[data-week-task-delete]");
    if(addButton){
      taskDate.value=addButton.dataset.planDate;
      updatePlannerWeekForDate(taskDate.value);
      renderWeeklyPlanner();
      taskInput.focus();
      return;
    }
    if(removeStepButton){
      var stepDate=removeStepButton.dataset.weekTaskDate,stepTasks=(tasksByDate[stepDate]||[]).slice(),stepTaskIndex=Number(removeStepButton.dataset.weekSubtaskDelete),stepIndex=Number(removeStepButton.dataset.weekSubtaskIndex),stepTask=stepTasks[stepTaskIndex];
      if(!stepTask||!stepTask.subtasks[stepIndex])return;
      stepTask.subtasks.splice(stepIndex,1);
      if(stepTask.subtasks.length)stepTask.completed=stepTask.subtasks.every(function(step){return step.completed});
      if(saveTasksForDate(stepDate,stepTasks)){
        document.getElementById("task-status").textContent="Step removed from the weekly plan.";
        renderTodayTasks();
        var details=weekDays.querySelector('[data-week-subtask-form="'+stepTaskIndex+'"][data-week-task-date="'+stepDate+'"]');
        if(details){details.closest("details").open=true;details.querySelector('input[name="subtask"]').focus()}
      }
      return;
    }
    if(!removeButton)return;
    var dateKey=removeButton.dataset.weekTaskDate,tasks=(tasksByDate[dateKey]||[]).slice(),taskIndex=Number(removeButton.dataset.weekTaskDelete);
    if(!tasks[taskIndex])return;
    tasks.splice(taskIndex,1);
    if(saveTasksForDate(dateKey,tasks)){document.getElementById("task-status").textContent="Task removed from the weekly plan.";renderTodayTasks()}
  });
  weekDays.addEventListener("submit",function(e){
    var stepForm=e.target.closest("[data-week-subtask-form]");
    if(!stepForm)return;
    e.preventDefault();
    var dateKey=stepForm.dataset.weekTaskDate,tasks=(tasksByDate[dateKey]||[]).slice(),taskIndex=Number(stepForm.dataset.weekSubtaskForm),task=tasks[taskIndex],stepInput=stepForm.querySelector('input[name="subtask"]'),title=stepInput.value.trim();
    if(!task||!title)return;
    if(task.subtasks.length>=40){stepInput.disabled=true;document.getElementById("task-status").textContent="A task can have up to 40 steps.";return}
    task.subtasks.push({title:title.slice(0,120),completed:false});
    task.completed=false;
    if(saveTasksForDate(dateKey,tasks)){
      document.getElementById("task-status").textContent="Step added to the weekly plan.";
      renderTodayTasks();
      var form=weekDays.querySelector('[data-week-subtask-form="'+taskIndex+'"][data-week-task-date="'+dateKey+'"]');
      if(form){form.closest("details").open=true;form.querySelector('input[name="subtask"]').focus()}
    }
  });
  var renameOverlay=document.getElementById("rename-overlay"),renameForm=document.getElementById("rename-form"),renameInput=document.getElementById("rename-input"),renameIndex=null;
  var scheduleOverlay=document.getElementById("schedule-overlay"),scheduleForm=document.getElementById("schedule-form"),scheduleIndex=null;
  var noteOverlay=document.getElementById("note-overlay"),noteForm=document.getElementById("note-form"),noteInput=document.getElementById("note-input"),noteIndex=null;
  function closeRename(restoreFocus){
    var previousIndex=renameIndex;
    renameOverlay.hidden=true;
    renameIndex=null;
    var previousButton=document.querySelector('[data-edit="'+previousIndex+'"]');
    if(restoreFocus!==false&&previousButton)previousButton.focus();
  }
  function closeSchedule(restoreFocus){
    var previousIndex=scheduleIndex;
    scheduleOverlay.hidden=true;
    scheduleIndex=null;
    var previousButton=document.querySelector('[data-schedule="'+previousIndex+'"]');
    if(restoreFocus!==false&&previousButton)previousButton.focus();
  }
  function closeNote(restoreFocus){
    var previousIndex=noteIndex;
    noteOverlay.hidden=true;
    noteIndex=null;
    var previousButton=document.querySelector('[data-note="'+previousIndex+'"]');
    if(restoreFocus!==false&&previousButton)previousButton.focus();
  }
  function setScheduleDays(days){
    scheduleForm.querySelectorAll('input[name="day"]').forEach(function(input){input.checked=days.indexOf(+input.value)!==-1});
  }
  document.getElementById("list").addEventListener("click",function(e){
    var b=e.target.closest("button,path");if(!b)return;
    if(b.dataset.timerAction!==undefined){
      var timerHabitIndex=+b.dataset.timerHabit;
      var timerHabit=habits[timerHabitIndex];
      if(!timerHabit||!timerHabit.durationMinutes){showToast("Add a duration like \"Read for 20 minutes\" to start a timer.");return}
      if(b.dataset.timerAction==="start"){
        if(!timerHabit.timer)timerHabit.timer={};
        timerHabit.timer.running=true;
        timerHabit.timer.startedAt=Date.now();
        timerHabit.timer.elapsedMs=getHabitTimerElapsed(timerHabit);
        save();
        render();
        return;
      }
      if(b.dataset.timerAction==="stop"){
        if(!timerHabit.timer)timerHabit.timer={};
        timerHabit.timer.running=false;
        timerHabit.timer.startedAt=null;
        timerHabit.timer.elapsedMs=getHabitTimerElapsed(timerHabit);
        save();
        render();
        return;
      }
      if(b.dataset.timerAction==="reset"){
        timerHabit.timer={running:false,startedAt:null,elapsedMs:0};
        save();
        render();
        return;
      }
    }
    if(b.dataset.del!==undefined){if(confirm("Delete this habit and its history?")){habits.splice(+b.dataset.del,1);save();render()}return}
    if(b.dataset.edit!==undefined){renameIndex=+b.dataset.edit;renameInput.value=habits[renameIndex].name;renameOverlay.hidden=false;renameInput.focus();renameInput.select();return}
    if(b.dataset.note!==undefined){noteIndex=+b.dataset.note;noteInput.value=habits[noteIndex].note||"";noteOverlay.hidden=false;noteInput.focus();noteInput.select();return}
    if(b.dataset.schedule!==undefined){scheduleIndex=+b.dataset.schedule;setScheduleDays(habits[scheduleIndex].days);document.getElementById("schedule-error").textContent="";scheduleOverlay.hidden=false;scheduleForm.querySelector('input[name="day"]').focus();return}
    if(b.dataset.d){var idx=+b.dataset.i;var h=habits[idx];if(!h){return}if(!h.log||typeof h.log!=="object")h.log={};if(h.log[b.dataset.d])delete h.log[b.dataset.d];else h.log[b.dataset.d]=1;lastPop=idx;save();render()}
  });
  renameForm.addEventListener("submit",function(e){
    e.preventDefault();
    var name=renameInput.value.trim();
    if(renameIndex===null||!habits[renameIndex]||!name){renameInput.focus();return}
    var renamedIndex=renameIndex;
    habits[renameIndex].name=name.slice(0,60);
    save();
    closeRename(false);
    render();
    var renamedButton=document.querySelector('[data-edit="'+renamedIndex+'"]');
    if(renamedButton)renamedButton.focus();
    showToast("Habit renamed.");
  });
  document.getElementById("rename-cancel").addEventListener("click",closeRename);
  renameOverlay.addEventListener("click",function(e){if(e.target===renameOverlay)closeRename()});
  renameOverlay.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();closeRename()}});
  noteForm.addEventListener("submit",function(e){
    e.preventDefault();
    var note=noteInput.value.trim();
    if(noteIndex===null||!habits[noteIndex]){noteInput.focus();return}
    habits[noteIndex].note=note.slice(0,240);
    save();
    closeNote(false);
    render();
    var noteButton=document.querySelector('[data-note="'+noteIndex+'"]');
    if(noteButton)noteButton.focus();
    showToast(note?"Habit note saved.":"Habit note cleared.");
  });
  document.getElementById("note-clear").addEventListener("click",function(){noteInput.value="";noteInput.focus();});
  document.getElementById("note-cancel").addEventListener("click",closeNote);
  noteOverlay.addEventListener("click",function(e){if(e.target===noteOverlay)closeNote()});
  noteOverlay.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();closeNote()}});
  scheduleForm.addEventListener("click",function(e){
    var preset=e.target.closest("[data-preset]");
    if(!preset)return;
    setScheduleDays(preset.dataset.preset==="weekdays"?[1,2,3,4,5]:[0,1,2,3,4,5,6]);
  });
  scheduleForm.addEventListener("submit",function(e){
    e.preventDefault();
    var days=Array.from(scheduleForm.querySelectorAll('input[name="day"]:checked')).map(function(input){return +input.value});
    if(scheduleIndex===null||!habits[scheduleIndex])return;
    if(!days.length){document.getElementById("schedule-error").textContent="Choose at least one day.";return}
    var savedIndex=scheduleIndex;
    habits[scheduleIndex].days=days;
    save();
    closeSchedule(false);
    render();
    var savedButton=document.querySelector('[data-schedule="'+savedIndex+'"]');
    if(savedButton)savedButton.focus();
    showToast("Habit schedule saved.");
  });
  document.getElementById("schedule-cancel").addEventListener("click",closeSchedule);
  scheduleOverlay.addEventListener("click",function(e){if(e.target===scheduleOverlay)closeSchedule()});
  scheduleOverlay.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();closeSchedule()}});
  function add(){var v=asText(document.getElementById("in").value).trim();if(!v)return;habits.push({name:v,log:{}});document.getElementById("in").value="";save();render()}
  document.getElementById("addbtn").addEventListener("click",add);
  document.getElementById("in").addEventListener("keydown",function(e){if(e.key==="Enter")add()});
  document.getElementById("change-profile").addEventListener("click",function(){window.location.href="Orbit_%20Habit%20Tracker.html"});
  if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    var dashboard=document.body,frame=0;
    dashboard.addEventListener("pointermove",function(e){
      if(e.pointerType==="touch")return;
      if(frame)cancelAnimationFrame(frame);
      frame=requestAnimationFrame(function(){
        var rect=dashboard.getBoundingClientRect();
        dashboard.style.setProperty("--cursor-x",(e.clientX-rect.left)+"px");
        dashboard.style.setProperty("--cursor-y",(e.clientY-rect.top+window.scrollY)+"px");
        var card=e.target.closest(".habit");
        if(card){
          var cardRect=card.getBoundingClientRect();
          card.style.setProperty("--tilt-x",(((e.clientY-cardRect.top)/cardRect.height-.5)*-8).toFixed(2)+"deg");
          card.style.setProperty("--tilt-y",(((e.clientX-cardRect.left)/cardRect.width-.5)*8).toFixed(2)+"deg");
        }
      });
    });
    dashboard.addEventListener("pointerout",function(e){
      var card=e.target.closest(".habit");
      if(card&&!card.contains(e.relatedTarget)){
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
      }
    });
  }
  var renderedDate=ds(new Date());
  setInterval(function(){
    var currentDate=ds(new Date());
    if(currentDate!==renderedDate){renderedDate=currentDate;render();return}
    if(habits.some(function(h){return h.durationMinutes&&h.timer&&h.timer.running}))render();
  },1000);
  setupReminder();
  setupBackup();
  setupTaskReminder();
  setupGoals();
  setupWeeklyReview();
  render();
  setupFocusTimer();
}
