// Check authentication
function isLoggedIn() {
    const session = localStorage.getItem('havhabit:session');
    return session !== null;
}

function getCurrentUser() {
    const session = localStorage.getItem('havhabit:session');
    return session ? JSON.parse(session) : null;
}

// Redirect to login if not authenticated
if (!isLoggedIn()) {
    window.location.href = 'login.html';
}

const currentUser = getCurrentUser();
const STORAGE_KEY = `habit tracker:${currentUser.id}:v1`;

const todayISO = (() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
})();

function useId(){ return Math.random().toString(36).slice(2,9); }

function sanitizeFilename(s){ return s.replace(/[^a-z0-9_\-]/gi,'_').slice(0,80); }

function csvEscape(s){
    if(s==null) return '';
    return '"' + String(s).replace(/"/g,'""') + '"';
}

function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Storage
function loadData(){
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {habits: []};
    }   catch(e){ console.error('load', e); return {habits: []}; }
}

function saveData(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadData();

function isDoneToday(habit){
    return habit.completions && habit.completions.includes(todayISO);
}

function toggleToday(habitId){
    const h = state.habits.find(h=>h.id===habitId);
    if(!h) return;
    h.completions = h.completions || [];
    if (h.completions.includes(todayISO)){
        h.completions = h.completions.filter(d=>d!==todayISO);
    } else {
        h.completions.push(todayISO);
    }
    saveData(state); render();
}

function deleteHabit(habitID){
    state.habits = state.habits.filter(h=>h.id!==habitID);
    saveData(state); render();
}

function resetAll(){
    if(!confirm('Reset ALL habits and completions? This cannot be undone.')) return;
    state = {habits: []};
    saveData(state); render();
}

function computeStreak(habit){
    const set = new Set((habit.completions||[]));
    let streak = 0;
    let d = new Date();
    d.setHours(0,0,0,0);
    while(true){
        const iso = d.toISOString().slice(0,10);
        if(set.has(iso)){ streak++; d.setDate(d.getDate()-1); continue; }
        break;
    }
    return streak;
}

function computeBestStreak(habit){
    if(!habit.completions || habit.completions.length === 0) return 0;
    
    const sorted = [...habit.completions].sort();
    let maxStreak = 0;
    let currentStreak = 1;
    
    for(let i = 1; i < sorted.length; i++){
        const prevDate = new Date(sorted[i-1]);
        const currDate = new Date(sorted[i]);
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if(diffDays === 1){
            currentStreak++;
        } else {
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 1;
        }
    }
    return Math.max(maxStreak, currentStreak);
}

function isAtRisk(habit){
    const streak = computeStreak(habit);
    return streak === 0 && habit.completions && habit.completions.length > 0;
}

function getWeekProgress(habit){
    const last7 = dayCompletedLast7(habit);
    const completed = last7.reduce((a,b) => a + b, 0);
    const goal = habit.weeklyGoal || 7;
    return {completed, goal, percentage: Math.round((completed / goal) * 100)};
}

function dayCompletedLast7(habit){
    const set = new Set(habit.completions || []);
    const arr = [];
    const now = new Date(); now.setHours(0,0,0,0);
    for(let i=6;i>=0;i--){
        const d = new Date(now); d.setDate(now.getDate()-i);
        arr.push(set.has(d.toISOString().slice(0,10)) ? 1 : 0);
    }
    return arr;
}

function calculateLifetimeSuccess(){
    if(state.habits.length === 0) return { percentage: 0, completions: 0, possibleDays: 0, activeHabits: 0 };
    
    // Only count habits that have been active (have at least 1 day tracked)
    const activeHabits = state.habits.filter(h => {
        const created = new Date(h.created);
        created.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        return created <= today;
    });
    
    if(activeHabits.length === 0) return { percentage: 0, completions: 0, possibleDays: 0, activeHabits: 0 };
    
    // Calculate average completion rate across all habits
    let totalPercentage = 0;
    let totalCompletions = 0;
    let totalPossibleDays = 0;
    
    activeHabits.forEach(habit => {
        const createdDate = new Date(habit.created);
        createdDate.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Days since habit was created (including today)
        const daysSinceCreated = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24)) + 1;
        const completions = (habit.completions || []).length;
        
        // Calculate this habit's completion rate
        const habitPercentage = (completions / daysSinceCreated) * 100;
        totalPercentage += habitPercentage;
        
        totalCompletions += completions;
        totalPossibleDays += daysSinceCreated;
    });
    
    // Average percentage across all habits for a balanced score
    const percentage = totalPercentage / activeHabits.length;
    
    return { 
        percentage, 
        completions: totalCompletions, 
        possibleDays: totalPossibleDays,
        activeHabits: activeHabits.length
    };
}

function getSuccessLevel(percentage){
    if(percentage >= 80) return { level: 'Elite Performer', color: '#10b981', emoji: '🏆' };
    if(percentage >= 65) return { level: 'Highly Consistent', color: '#34d399', emoji: '⭐' };
    if(percentage >= 50) return { level: 'Building Momentum', color: '#6ee7b7', emoji: '💪' };
    if(percentage >= 35) return { level: 'Getting Started', color: '#fbbf24', emoji: '🌱' };
    if(percentage >= 20) return { level: 'Early Progress', color: '#fb923c', emoji: '🎯' };
    return { level: 'Just Beginning', color: '#94a3b8', emoji: '🚀' };
}

// UI Rendering
const $habits = document.getElementById('habits');
const $count = document.getElementById('countHabits');
const $todayLabel = document.getElementById('todayLabel');
const $successMeter = document.getElementById('successMeter');
const $successPercent = document.getElementById('successPercent');
const $successLevel = document.getElementById('successLevel');
const $successStats = document.getElementById('successStats');
const $insightsContainer = document.getElementById('insightsContainer');
$todayLabel.textContent = todayISO;

const motivationalQuotes = [
    "Small daily improvements lead to staggering long-term results.",
    "You don't have to be great to start, but you have to start to be great.",
    "Success is the sum of small efforts repeated day in and day out.",
    "The secret of getting ahead is getting started.",
    "Don't break the chain. Keep your streak alive!",
    "Progress, not perfection. Every day counts.",
    "Your future self will thank you for the habits you build today.",
    "Discipline is choosing between what you want now and what you want most.",
    "It's not about being perfect. It's about showing up consistently.",
    "Motivation gets you started. Habit keeps you going."
];

function showMotivationalQuote(){
    const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    document.getElementById('motivationalQuote').textContent = `💡 "${quote}"`;
}

function updateInsights(){
    if(state.habits.length === 0){
        $insightsContainer.style.display = 'none';
        return;
    }
    
    $insightsContainer.style.display = 'grid';
    
    // Longest streak across all habits
    const longestStreak = Math.max(...state.habits.map(h => computeBestStreak(h)), 0);
    document.getElementById('longestStreak').textContent = `${longestStreak} days`;
    
    // Habits at risk (broken streak)
    const atRisk = state.habits.filter(h => isAtRisk(h)).length;
    document.getElementById('atRisk').textContent = `${atRisk} habits`;
    
    // This week's overall progress
    let totalCompleted = 0;
    let totalGoal = 0;
    state.habits.forEach(h => {
        const progress = getWeekProgress(h);
        totalCompleted += progress.completed;
        totalGoal += progress.goal;
    });
    const weekPercentage = totalGoal > 0 ? Math.round((totalCompleted / totalGoal) * 100) : 0;
    document.getElementById('weekProgress').textContent = `${weekPercentage}%`;
}

function render(){
  $habits.innerHTML = '';
  $count.textContent = state.habits.length;
  
  // Update success meter
  const success = calculateLifetimeSuccess();
  const level = getSuccessLevel(success.percentage);
  $successPercent.textContent = success.percentage.toFixed(1) + '%';
  $successLevel.textContent = `${level.emoji} ${level.level}`;
  $successLevel.style.color = level.color;
  $successStats.textContent = `${success.completions} / ${success.possibleDays} days completed`;
  $successMeter.querySelector('i').style.width = success.percentage + '%';
  $successMeter.querySelector('i').style.background = `linear-gradient(90deg, ${level.color}, ${level.color})`;
  
  // Update insights
  updateInsights();
  
  if(state.habits.length === 0){
    $habits.innerHTML = `<div class="card small">No habits yet — add one above to get started.</div>`;
    return;
  }

for(const h of state.habits){
    const card = document.createElement('div');
    card.className = `card`;
    const doneToday = isDoneToday(h);
    const streak = computeStreak(h);
    const bestStreak = computeBestStreak(h);
    const weekProgress = getWeekProgress(h);
    const atRisk = isAtRisk(h);
    const categoryEmoji = {'health':'🏃','learning':'📚','productivity':'💼','mindfulness':'🧘','social':'👥','other':'✨'}[h.category || 'other'];
    const last7 = dayCompletedLast7(h); // array of 0/1

    card.innerHTML = `
      <div class="habit-row">
        <input type="checkbox" class="chk" ${doneToday? 'checked':''} aria-label="Mark ${escapeHtml(h.name)} done for today" />
        <div style="flex:1">
          <div>
            <span class="habit-category">${categoryEmoji} ${(h.category || 'other').toUpperCase()}</span>
            ${atRisk ? '<span class="at-risk">⚠️ At Risk</span>' : ''}
          </div>
          <div class="habit-title">${escapeHtml(h.name)}</div>
          <div class="small">
            Streak: <strong>${streak}</strong> 
            ${bestStreak > streak ? `<span class="best-streak">• Best: ${bestStreak} 🏆</span>` : ''}
          </div>
          <div class="weekly-goal">Week: ${weekProgress.completed}/${weekProgress.goal} days (${weekProgress.percentage}%)</div>
          <div class="progress" aria-hidden="true"><i style="width:${Math.round((last7.reduce((a,b)=>a+b,0)/7)*100)}%"></i></div>
        </div>
      </div>
      <div class="controls">
        <button class="icon-btn js-toggle">Toggle Today</button>
        <button class="icon-btn js-note">Add Note</button>
        <button class="icon-btn js-export">Export</button>
        <button class="icon-btn js-delete" title="Delete">Delete</button>
      </div>
    `;
// events
card.querySelector('.js-toggle').addEventListener('click', ()=> toggleToday(h.id));
card.querySelector('.chk').addEventListener('change', ()=> toggleToday(h.id));
card.querySelector('.js-note').addEventListener('click', ()=> {
    const note = prompt(`Add a note for "${h.name}" today:`, h.todayNote || '');
    if(note !== null){
        h.todayNote = note.trim();
        saveData(state);
        render();
    }
});
card.querySelector('.js-export').addEventListener('click', ()=> {
    const csv = habitToCSV(h);
    downloadFile(csv, `${sanitizeFilename(h.name)}.csv`, 'text/csv');
});
card.querySelector('.js-delete').addEventListener('click', ()=> {
    if(confirm(`Delete "${h.name}"? This cannot be undone.`)){
        deleteHabit(h.id);
    }
});

$habits.appendChild(card);
    }
}

//Form Handling
document.getElementById('addForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = document.getElementById('habitName');
    const categorySelect = document.getElementById('habitCategory');
    const weeklyGoalInput = document.getElementById('weeklyGoal');
    
    const name = input.value.trim();
    if(!name) return;
    
    const newH = { 
        id: useId(), 
        name, 
        created: todayISO, 
        completions: [],
        category: categorySelect.value,
        weeklyGoal: parseInt(weeklyGoalInput.value) || 7
    };
    
    state.habits.push(newH);
    saveData(state);
    input.value = '';
    render();
});

document.getElementById('resetAll').addEventListener('click', resetAll);

// Logout Button
document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('havhabit:session');
        window.location.href = 'login.html';
    }
});

// CSV Export
document.getElementById('exportCSV').addEventListener('click', ()=>{
    if(state.habits.length===0){ alert('No habits to export'); return; }
    const headers = ['name','created','completions'];
    const lines = state.habits.map(h=> [
        csvEscape(h.name),
        h.created,
        csvEscape((h.completions||[]).join(';'))
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    downloadFile(csv, 'habits_export.csv', 'text/csv');
});

function habitToCSV(h){
  const header = ['date','done'];
  // build last 30 days
  const out = [header.join(',')];
  const now = new Date(); now.setHours(0,0,0,0);
  for(let i=29;i>=0;i--){
    const d = new Date(now); d.setDate(now.getDate()-i);
    const iso = d.toISOString().slice(0,10);
    out.push([iso, (h.completions||[]).includes(iso) ? '1' : '0'].join(','));
  }
  return out.join('\n');
}

function downloadFile(content, filename, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
// Initial render
render();
showMotivationalQuote();

// Change quote daily
setInterval(showMotivationalQuote, 60000 * 60); // Every hour

// keyboard shortcut: ctrl/cmd + A to add sample habits (only if list empty)
window.addEventListener('keydown', (e)=> {
  if(e.key === 'A' && (e.ctrlKey || e.metaKey)){
    if(state.habits.length) return;
    state.habits.push(
      {id:useId(), name:'Read 20 minutes', created:todayISO, completions: [todayISO]},
      {id:useId(), name:'Workout (30m)', created:todayISO, completions: []},
      {id:useId(), name:'Meditate', created:todayISO, completions: []}
    );
    saveData(state); render();
  }
});

// Dark Mode Toggle
const darkModeToggle = document.getElementById("darkModeToggle");

// Load saved dark mode preference
const savedDarkMode = localStorage.getItem('darkMode') === 'true';
if(savedDarkMode){
    document.body.classList.add('light-mode');
    darkModeToggle.checked = true;
}

darkModeToggle.addEventListener("change", () => {
    if(darkModeToggle.checked){
        document.body.classList.add("light-mode");
        localStorage.setItem('darkMode', 'true');
    } else {
        document.body.classList.remove("light-mode");
        localStorage.setItem('darkMode', 'false');
    }
});