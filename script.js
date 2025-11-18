// Check authentication
function isLoggedIn() {
    const session = localStorage.getItem('havhabit:session');
    return session !== null;
}

function getCurrentUser() {
    const session = localStorage.getItem('havhabit:session');
    return session ? JSON.parse(session) : null;
}

// Check if onboarding is completed
function isOnboardingCompleted() {
    const user = getCurrentUser();
    if (!user) return false;
    return localStorage.getItem(`onboarding:${user.id}:completed`) === 'true';
}

// Redirect to login if not authenticated
if (!isLoggedIn()) {
    console.log('Not logged in, redirecting to login');
    window.location.href = 'login.html';
}

// Redirect to onboarding if not completed (only if on main app page)
if (isLoggedIn() && !isOnboardingCompleted() && window.location.pathname.includes('index.html')) {
    console.log('Onboarding not completed, redirecting');
    window.location.href = 'onboarding.html';
}

console.log('User authenticated and ready:', getCurrentUser());

const currentUser = getCurrentUser();
const STORAGE_KEY = `habit tracker:${currentUser.id}:v1`;
const GAMIFICATION_KEY = `habit gamification:${currentUser.id}:v1`;
const ANALYTICS_KEY = `habit analytics:${currentUser.id}:v1`;

const todayISO = (() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
})();

function useId(){ return Math.random().toString(36).slice(2,9); }

// Gamification Data Structure
let gamificationData = (() => {
    try {
        const raw = localStorage.getItem(GAMIFICATION_KEY);
        return raw ? JSON.parse(raw) : {
            points: 0,
            level: 1,
            achievements: [],
            streakHistory: {},
            lastUpdate: todayISO
        };
    } catch(e){ 
        return {points: 0, level: 1, achievements: [], streakHistory: {}, lastUpdate: todayISO};
    }
})();

// Analytics Data Structure
let analyticsData = (() => {
    try {
        const raw = localStorage.getItem(ANALYTICS_KEY);
        return raw ? JSON.parse(raw) : {
            failurePatterns: {},
            triggerLogs: [],
            urgeSurfLogs: [],
            evidencePhotos: []
        };
    } catch(e){ 
        return {failurePatterns: {}, triggerLogs: [], urgeSurfLogs: [], evidencePhotos: []};
    }
})();

function saveGamification(){ localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(gamificationData)); }
function saveAnalytics(){ localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analyticsData)); }

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
    if(habit.type === 'bad'){
        // For bad habits, "done" means you AVOIDED it today
        return habit.completions && habit.completions.includes(todayISO);
    }
    return habit.completions && habit.completions.includes(todayISO);
}

function toggleToday(habitId){
    const h = state.habits.find(h=>h.id===habitId);
    if(!h) return;
    h.completions = h.completions || [];
    const wasCompleted = h.completions.includes(todayISO);
    
    // Haptic feedback for native apps
    if (window.nativeApp && window.nativeApp.isNative()) {
        window.nativeApp.hapticImpact('light').catch(() => {});
    }
    
    if (wasCompleted){
        h.completions = h.completions.filter(d=>d!==todayISO);
        // LOSS: Deduct points for unchecking
        updatePoints(-5, 'Unchecked habit');
    } else {
        h.completions.push(todayISO);
        // GAIN: Award points for completion
        const points = calculateCompletionPoints(h);
        updatePoints(points, `Completed: ${h.name}`);
        
        // Success haptic
        if (window.nativeApp && window.nativeApp.isNative()) {
            window.nativeApp.hapticNotification('success').catch(() => {});
        }
        
        // Check for streak milestones
        const streak = computeStreak(h);
        if(streak > 0 && streak % 7 === 0){
            unlockAchievement(`streak_${streak}`, `${streak} Day Streak!`, `🔥 Maintained a ${streak}-day streak`);
        }
    }
    
    saveData(state); 
    saveGamification();
    render();
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
    if(percentage >= 80) return { level: 'Elite Performer', color: '#10b981', emoji: '🏆', class: 'elite' };
    if(percentage >= 65) return { level: 'Highly Consistent', color: '#34d399', emoji: '⭐', class: 'consistent' };
    if(percentage >= 50) return { level: 'Building Momentum', color: '#6ee7b7', emoji: '💪', class: 'momentum' };
    if(percentage >= 35) return { level: 'Getting Started', color: '#fbbf24', emoji: '🌱', class: 'started' };
    if(percentage >= 20) return { level: 'Early Progress', color: '#fb923c', emoji: '🎯', class: 'early' };
    return { level: 'Just Beginning', color: '#94a3b8', emoji: '🚀', class: 'beginner' };
}

// ========================================
// GAMIFICATION SYSTEM
// ========================================

function calculateCompletionPoints(habit){
    let points = 10; // Base points
    
    // Difficulty multiplier
    const difficultyMultiplier = {
        'tiny': 1,
        'easy': 1.5,
        'medium': 2,
        'hard': 3
    };
    points *= (difficultyMultiplier[habit.difficulty] || 1.5);
    
    // Streak bonus
    const streak = computeStreak(habit);
    if(streak >= 7) points += 5;
    if(streak >= 30) points += 15;
    if(streak >= 100) points += 50;
    
    // Type bonus
    if(habit.type === 'bad') points *= 1.5; // Breaking bad habits is harder
    
    return Math.round(points);
}

function updatePoints(points, reason){
    gamificationData.points += points;
    if(gamificationData.points < 0) gamificationData.points = 0;
    
    // Level up system
    const newLevel = Math.floor(gamificationData.points / 100) + 1;
    if(newLevel > gamificationData.level){
        gamificationData.level = newLevel;
        unlockAchievement(`level_${newLevel}`, `Level ${newLevel}!`, `🎯 Reached level ${newLevel}`);
    }
    
    updatePointsDisplay();
}

function updatePointsDisplay(){
    const pointsEl = document.getElementById('totalPoints');
    const levelEl = document.getElementById('levelBadge');
    if(pointsEl) pointsEl.textContent = gamificationData.points;
    if(levelEl){
        levelEl.textContent = `Level ${gamificationData.level}`;
        
        // Apply level tier class for gradient styling
        const pointsDisplay = document.querySelector('.points-display');
        if(pointsDisplay){
            pointsDisplay.classList.remove('level-1-3', 'level-4-7', 'level-8-plus');
            if(gamificationData.level <= 3){
                pointsDisplay.classList.add('level-1-3');
                levelEl.className = 'level-badge level-1-3';
            } else if(gamificationData.level <= 7){
                pointsDisplay.classList.add('level-4-7');
                levelEl.className = 'level-badge level-4-7';
            } else {
                pointsDisplay.classList.add('level-8-plus');
                levelEl.className = 'level-badge level-8-plus';
            }
        }
    }
}

function unlockAchievement(id, title, description){
    if(gamificationData.achievements.find(a => a.id === id)) return; // Already unlocked
    
    const achievement = { id, title, description, unlockedAt: new Date().toISOString() };
    gamificationData.achievements.push(achievement);
    
    // Show notification
    showNotification(`🏆 ${title}`, description);
    
    updateAchievementsDisplay();
    saveGamification();
}

function updateAchievementsDisplay(){
    const container = document.getElementById('achievementsList');
    if(!container) return;
    
    const recent = gamificationData.achievements.slice(-3).reverse();
    container.innerHTML = recent.map(a => `
        <div class="achievement-item">
            <span class="achievement-icon">🏆</span>
            <div class="achievement-info">
                <div class="achievement-title">${escapeHtml(a.title)}</div>
                <div class="achievement-desc">${escapeHtml(a.description)}</div>
            </div>
        </div>
    `).join('');
}

function updateHabitGarden(){
    const gardenEl = document.getElementById('gardenVisual');
    if(!gardenEl) return;
    
    gardenEl.innerHTML = state.habits.slice(0, 12).map(h => {
        const streak = computeStreak(h);
        let plant = '🌱'; // Seed
        
        if(streak >= 30) plant = '🌳'; // Tree
        else if(streak >= 14) plant = '🌿'; // Plant
        else if(streak >= 7) plant = '🪴'; // Potted plant
        else if(streak === 0 && h.completions.length > 0) plant = '🥀'; // Wilted
        
        return `<div class="garden-plant" title="${escapeHtml(h.name)} - ${streak} day streak">${plant}</div>`;
    }).join('');
}

// ========================================
// HABIT STACKING & TRIGGERS
// ========================================

function checkHabitTriggers(){
    const now = new Date();
    const currentHour = now.getHours();
    
    state.habits.forEach(h => {
        if(!h.trigger) return;
        if(isDoneToday(h)) return; // Already done today
        
        // Check if trigger time matches
        if(h.triggerTime){
            const [hour, minute] = h.triggerTime.split(':').map(Number);
            if(currentHour === hour){
                showNotification(`⏰ Time for: ${h.name}`, h.trigger);
            }
        }
    });
}

// ========================================
// BAD HABIT PREVENTION TOOLS
// ========================================

function startUrgeSurfing(habitId){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h) return;
    
    const surfTime = 10 * 60; // 10 minutes in seconds
    const startTime = Date.now();
    
    showUrgeSurfModal(h, surfTime, startTime);
}

function showUrgeSurfModal(habit, surfTime, startTime){
    const modal = document.createElement('div');
    modal.className = 'urge-surf-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>🌊 Urge Surfing for: ${escapeHtml(habit.name)}</h3>
            <p>Wait 10 minutes. The urge will pass like a wave.</p>
            <div class="timer-display" id="urgeSurfTimer">10:00</div>
            <div class="urge-surf-tips">
                <h4>While you wait:</h4>
                <ul>
                    <li>🧘 Take deep breaths</li>
                    <li>💧 Drink water</li>
                    <li>🚶 Go for a walk</li>
                    <li>📝 Journal your feelings</li>
                </ul>
            </div>
            ${habit.replacementBehavior ? `
                <div class="replacement-suggestion">
                    <h4>✨ Instead, try:</h4>
                    <p>${escapeHtml(habit.replacementBehavior)}</p>
                </div>
            ` : ''}
            <button class="btn-primary" onclick="closeUrgeSurfModal(true)">✅ I Resisted!</button>
            <button class="btn-secondary" onclick="closeUrgeSurfModal(false)">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = surfTime - elapsed;
        
        if(remaining <= 0){
            clearInterval(interval);
            document.getElementById('urgeSurfTimer').textContent = 'Wave passed! 🎉';
            // Award points for successful urge surf
            updatePoints(25, 'Successfully surfed urge');
            unlockAchievement('urge_surf', 'Urge Surfer', '🌊 Successfully waited out an urge');
        } else {
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            document.getElementById('urgeSurfTimer').textContent = 
                `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

window.closeUrgeSurfModal = function(success){
    const modal = document.querySelector('.urge-surf-modal');
    if(modal){
        if(success){
            // Log the successful urge surf
            analyticsData.urgeSurfLogs.push({
                timestamp: new Date().toISOString(),
                success: true
            });
            saveAnalytics();
        }
        modal.remove();
    }
}

function logTrigger(habitId, triggerType, notes){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h) return;
    
    analyticsData.triggerLogs.push({
        habitId,
        habitName: h.name,
        triggerType, // 'time', 'location', 'emotion', 'social', 'other'
        notes,
        timestamp: new Date().toISOString()
    });
    
    saveAnalytics();
    analyzeTriggerPatterns(habitId);
}

function analyzeTriggerPatterns(habitId){
    const logs = analyticsData.triggerLogs.filter(l => l.habitId === habitId);
    if(logs.length < 3) return null;
    
    // Find most common trigger
    const triggerCounts = {};
    logs.forEach(log => {
        triggerCounts[log.triggerType] = (triggerCounts[log.triggerType] || 0) + 1;
    });
    
    const mostCommon = Object.entries(triggerCounts)
        .sort((a, b) => b[1] - a[1])[0];
    
    return { triggerType: mostCommon[0], count: mostCommon[1] };
}

function calculateBadHabitCost(habit){
    if(habit.type !== 'bad') return null;
    if(!habit.costPerDay) return null;
    
    const daysSinceCreated = Math.floor(
        (new Date() - new Date(habit.created)) / (1000 * 60 * 60 * 24)
    );
    const daysIndulged = daysSinceCreated - (habit.completions || []).length;
    
    return {
        totalCost: daysIndulged * habit.costPerDay,
        daysIndulged,
        daysSinceCreated
    };
}

// ========================================
// SMART ANALYTICS & PREDICTIONS
// ========================================

function predictFailureRisk(){
    const predictions = [];
    
    state.habits.forEach(h => {
        const streak = computeStreak(h);
        const last7 = dayCompletedLast7(h);
        const completionRate = last7.reduce((a,b) => a+b, 0) / 7;
        
        let risk = 'low';
        let riskScore = 0;
        
        // Risk factors
        if(streak === 0 && h.completions.length > 0) riskScore += 3; // Broken streak
        if(completionRate < 0.5) riskScore += 2; // Low recent completion
        if(isWeekend() && h.weekendFailureRate > 0.6) riskScore += 2; // Weekend weakness
        if(!isDoneToday(h)) riskScore += 1; // Not done today
        
        if(riskScore >= 5) risk = 'high';
        else if(riskScore >= 3) risk = 'medium';
        
        predictions.push({ habit: h, risk, riskScore });
    });
    
    return predictions.filter(p => p.risk !== 'low');
}

function isWeekend(){
    const day = new Date().getDay();
    return day === 0 || day === 6;
}

function analyzeHabitCorrelations(){
    if(state.habits.length < 2) return [];
    
    const correlations = [];
    
    for(let i = 0; i < state.habits.length; i++){
        for(let j = i + 1; j < state.habits.length; j++){
            const h1 = state.habits[i];
            const h2 = state.habits[j];
            
            const correlation = calculateCorrelation(h1, h2);
            if(Math.abs(correlation) > 0.5){
                correlations.push({
                    habit1: h1.name,
                    habit2: h2.name,
                    correlation: correlation.toFixed(2),
                    type: correlation > 0 ? 'positive' : 'negative'
                });
            }
        }
    }
    
    return correlations;
}

function calculateCorrelation(h1, h2){
    const last30 = [];
    for(let i = 29; i >= 0; i--){
        const d = new Date();
        d.setDate(d.getDate() - i);
        last30.push(d.toISOString().slice(0,10));
    }
    
    const set1 = new Set(h1.completions || []);
    const set2 = new Set(h2.completions || []);
    
    const pairs = last30.map(day => [
        set1.has(day) ? 1 : 0,
        set2.has(day) ? 1 : 0
    ]);
    
    // Simple correlation coefficient
    const n = pairs.length;
    const sum1 = pairs.reduce((s, p) => s + p[0], 0);
    const sum2 = pairs.reduce((s, p) => s + p[1], 0);
    const sum1sq = pairs.reduce((s, p) => s + p[0] * p[0], 0);
    const sum2sq = pairs.reduce((s, p) => s + p[1] * p[1], 0);
    const psum = pairs.reduce((s, p) => s + p[0] * p[1], 0);
    
    const num = psum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1sq - sum1 * sum1 / n) * (sum2sq - sum2 * sum2 / n));
    
    if(den === 0) return 0;
    return num / den;
}

function getWeeklyInsights(){
    const insights = [];
    
    // Identify best day
    const dayPerformance = Array(7).fill(0);
    state.habits.forEach(h => {
        (h.completions || []).forEach(date => {
            const day = new Date(date).getDay();
            dayPerformance[day]++;
        });
    });
    const bestDay = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        [dayPerformance.indexOf(Math.max(...dayPerformance))];
    insights.push(`📅 Your best day: ${bestDay}`);
    
    // Identify struggling habits
    const struggling = state.habits.filter(h => {
        const last7 = dayCompletedLast7(h);
        return last7.reduce((a,b) => a+b, 0) < 3;
    });
    if(struggling.length > 0){
        insights.push(`⚠️ ${struggling.length} habit(s) need attention this week`);
    }
    
    // Streak momentum
    const longestCurrent = Math.max(0, ...state.habits.map(h => computeStreak(h)));
    if(longestCurrent >= 7){
        insights.push(`🔥 Longest active streak: ${longestCurrent} days!`);
    }
    
    return insights;
}

// ========================================
// CONTEXTUAL COACHING
// ========================================

function getPersonalizedTip(){
    const tips = [];
    
    // Analyze patterns and provide tips
    const atRiskHabits = state.habits.filter(isAtRisk);
    if(atRiskHabits.length > 0){
        tips.push({
            type: 'warning',
            message: `🚨 You have ${atRiskHabits.length} habit(s) at risk. Start with the easiest one today!`
        });
    }
    
    const perfectWeek = state.habits.filter(h => {
        const progress = getWeekProgress(h);
        return progress.percentage >= 100;
    });
    if(perfectWeek.length > 0){
        tips.push({
            type: 'success',
            message: `🎉 ${perfectWeek.length} perfect week(s)! You're building unstoppable momentum.`
        });
    }
    
    // Time-based tips
    const hour = new Date().getHours();
    if(hour < 10){
        tips.push({
            type: 'info',
            message: '🌅 Morning is the best time to build habits. Win the day early!'
        });
    } else if(hour >= 20){
        tips.push({
            type: 'info',
            message: '🌙 Evening check-in: Review your day and plan tomorrow\'s wins.'
        });
    }
    
    // Correlations
    const correlations = analyzeHabitCorrelations();
    if(correlations.length > 0 && correlations[0].type === 'positive'){
        const c = correlations[0];
        tips.push({
            type: 'insight',
            message: `💡 "${c.habit1}" and "${c.habit2}" boost each other. Do them together!`
        });
    }
    
    return tips[Math.floor(Math.random() * tips.length)] || {
        type: 'info',
        message: '🎯 Consistency beats intensity. Small daily actions compound into big results.'
    };
}

function showPostMortem(habitId){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h) return;
    
    const modal = document.createElement('div');
    modal.className = 'post-mortem-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>🤔 Why did you miss: ${escapeHtml(h.name)}?</h3>
            <p>Understanding your obstacles helps you overcome them.</p>
            <div class="post-mortem-options">
                <button class="pm-option" onclick="recordFailureReason('${h.id}', 'time')">⏰ No time</button>
                <button class="pm-option" onclick="recordFailureReason('${h.id}', 'forgot')">🧠 Forgot</button>
                <button class="pm-option" onclick="recordFailureReason('${h.id}', 'tired')">😴 Too tired</button>
                <button class="pm-option" onclick="recordFailureReason('${h.id}', 'unmotivated')">😔 Not motivated</button>
                <button class="pm-option" onclick="recordFailureReason('${h.id}', 'circumstances')">🌧️ Circumstances</button>
            </div>
            <textarea id="failureNotes" placeholder="Additional notes (optional)..." rows="3"></textarea>
            <button class="btn-primary" onclick="closePostMortem()">Submit</button>
        </div>
    `;
    document.body.appendChild(modal);
}

window.recordFailureReason = function(habitId, reason){
    if(!analyticsData.failurePatterns[habitId]){
        analyticsData.failurePatterns[habitId] = {};
    }
    analyticsData.failurePatterns[habitId][reason] = 
        (analyticsData.failurePatterns[habitId][reason] || 0) + 1;
    saveAnalytics();
}

window.closePostMortem = function(){
    const modal = document.querySelector('.post-mortem-modal');
    if(modal) modal.remove();
}

// ========================================
// EVIDENCE COLLECTION
// ========================================

async function captureHabitEvidence(habitId){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h) return;
    
    // Use native camera if available
    if (window.nativeApp && window.nativeApp.isNative()) {
        try {
            const photoData = await window.nativeApp.capturePhoto();
            if (photoData) {
                analyticsData.evidencePhotos.push({
                    habitId,
                    habitName: h.name,
                    timestamp: new Date().toISOString(),
                    data: photoData
                });
                saveAnalytics();
                showNotification('📸 Evidence captured!', 'Photo proof added');
                await window.nativeApp.hapticNotification('success');
            }
            return;
        } catch (e) {
            console.error('Native camera failed, falling back to web:', e);
        }
    }
    
    // Web fallback
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if(file){
            const reader = new FileReader();
            reader.onload = (ev) => {
                analyticsData.evidencePhotos.push({
                    habitId,
                    habitName: h.name,
                    timestamp: new Date().toISOString(),
                    data: ev.target.result
                });
                saveAnalytics();
                showNotification('📸 Evidence captured!', 'Photo proof added');
            };
            reader.readAsDataURL(file);
        }
    };
    
    input.click();
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================

function showNotification(title, message){
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ========================================
// FRICTION DESIGN
// ========================================

function addBadHabitFriction(habitId){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h || h.type !== 'bad') return;
    
    // Add confirmation step
    const confirmMsg = `⚠️ Are you sure you want to mark "${h.name}" as done?\n\n` +
                      `This means you gave in to the bad habit today.\n\n` +
                      `Remember: You're trying to BREAK this habit.\n\n` +
                      `Click OK only if you actually did it.`;
    
    if(!confirm(confirmMsg)){
        return false;
    }
    
    // Show urge surfing option
    if(confirm('💡 Want to try urge surfing instead? (Wait 10 minutes before deciding)')){
        startUrgeSurfing(habitId);
        return false;
    }
    
    return true;
}

// UI Rendering
const $habits = document.getElementById('habits');
const $count = document.getElementById('countHabits');
const $todayLabel = document.getElementById('todayLabel');
const $successMeter = document.getElementById('successMeter');
const $successPercent = document.getElementById('successPercent');
const $successLevel = document.getElementById('successLevel');
const $insightsContainer = document.getElementById('insightsContainer');
if($todayLabel) $todayLabel.textContent = todayISO;

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
        document.getElementById('analyticsDashboard').style.display = 'none';
        return;
    }
    
    $insightsContainer.style.display = 'grid';
    document.getElementById('analyticsDashboard').style.display = 'grid';
    
    // Longest streak across all habits
    const longestStreak = Math.max(...state.habits.map(h => computeBestStreak(h)), 0);
    document.getElementById('longestStreak').textContent = `${longestStreak} days`;
    
    // Update sidebar stats (now in inline stat cards)
    const sidebarStreak = document.getElementById('longestStreakSidebar');
    const sidebarWeek = document.getElementById('weekProgressSidebar');
    const userNameEl = document.getElementById('userName');
    const countEl = document.getElementById('countHabits');
    
    if(sidebarStreak) sidebarStreak.textContent = `${longestStreak}d`;
    if(userNameEl && currentUser) userNameEl.textContent = currentUser.username || 'User';
    if(countEl) countEl.textContent = state.habits.length;
    
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
    if(sidebarWeek) sidebarWeek.textContent = `${weekPercentage}%`;
    
    // Overall completion rate
    const totalPossible = state.habits.reduce((sum, h) => {
        const created = new Date(h.created);
        const today = new Date();
        const days = Math.floor((today - created) / (1000 * 60 * 60 * 24)) + 1;
        return sum + days;
    }, 0);
    const totalCompletions = state.habits.reduce((sum, h) => sum + (h.completions || []).length, 0);
    const completionRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    
    // Bad habits avoided
    const badHabits = state.habits.filter(h => h.type === 'bad');
    const badHabitsAvoided = badHabits.reduce((sum, h) => sum + (h.completions || []).length, 0);
    document.getElementById('badHabitsAvoided').textContent = `${badHabitsAvoided} days`;
    
    // Update charts
    updateCharts();
    updateGoalsOverview();
}

function render(){
  $habits.innerHTML = '';
  if($count) $count.textContent = state.habits.length;
  
  // Update success meter
  const success = calculateLifetimeSuccess();
  const level = getSuccessLevel(success.percentage);
  $successPercent.textContent = success.percentage.toFixed(1) + '%';
  $successLevel.textContent = `${level.emoji} ${level.level}`;
  $successLevel.style.color = level.color;
  
  // Apply gradient class to banner and progress bar
  const banner = document.querySelector('.success-banner');
  const progressBar = $successMeter;
  if(banner){
      banner.className = 'success-banner ' + level.class;
  }
  if(progressBar){
      progressBar.className = 'progress-bar-large ' + level.class;
      const progressBarSpan = progressBar.querySelector('span');
      if(progressBarSpan){
          progressBarSpan.style.width = success.percentage + '%';
      }
  }
  
  // Update gamification displays
  updatePointsDisplay();
  updateAchievementsDisplay();
  updateHabitGarden();
  
  // Show gamification section if user has any points or achievements
  const gamificationSection = document.getElementById('gamificationSection');
  if(gamificationData.points > 0 || gamificationData.achievements.length > 0){
      gamificationSection.style.display = 'block';
  }
  
  // Update insights
  updateInsights();
  
  // Show contextual tip
  const tip = getPersonalizedTip();
  if(tip){
      const tipEl = document.getElementById('contextualTip');
      if(tipEl){
          tipEl.innerHTML = `<div class="tip-${tip.type}">${tip.message}</div>`;
      }
  }
  
  if(state.habits.length === 0){
    $habits.innerHTML = `<div class="card small">No habits yet — add one above to get started.</div>`;
    return;
  }

for(const h of state.habits){
    const card = document.createElement('div');
    card.className = h.type === 'bad' ? 'card bad-habit-card' : 'card';
    const doneToday = isDoneToday(h);
    const streak = computeStreak(h);
    const bestStreak = computeBestStreak(h);
    const weekProgress = getWeekProgress(h);
    const atRisk = isAtRisk(h);
    const categoryEmoji = {'health':'🏃','learning':'📚','productivity':'💼','mindfulness':'🧘','social':'👥','other':'✨'}[h.category || 'other'];
    const last7 = dayCompletedLast7(h);
    const isBadHabit = h.type === 'bad';
    const habitLabel = isBadHabit ? `${doneToday ? 'Avoided' : 'Did it'}` : `${doneToday ? 'Done' : 'Not done'}`;
    const difficultyEmoji = {'tiny':'🐣','easy':'😌','medium':'⚖️','hard':'💪'}[h.difficulty || 'medium'];

    card.innerHTML = `
      <div class="habit-quick-actions">
        <button class="quick-action-btn js-quick-edit" title="Quick Edit">✏️</button>
        <button class="quick-action-btn js-quick-delete" title="Quick Delete">🗑️</button>
      </div>
      <div class="habit-row">
        <input type="checkbox" class="chk" ${doneToday? 'checked':''} aria-label="Mark ${escapeHtml(h.name)} ${isBadHabit ? 'avoided' : 'done'} for today" />
        <div style="flex:1">
          <div>
            <span class="habit-category ${isBadHabit ? 'bad-habit' : ''}">${isBadHabit ? '🚫' : categoryEmoji} ${isBadHabit ? 'BAD HABIT' : (h.category || 'other').toUpperCase()}</span>
            <span class="difficulty-badge" title="Difficulty">${difficultyEmoji}</span>
            ${atRisk ? '<span class="at-risk">⚠️ At Risk</span>' : ''}
            ${h.identity ? `<span class="identity-badge" title="Your Identity">🎯 ${escapeHtml(h.identity)}</span>` : ''}
          </div>
          <div class="habit-title">${escapeHtml(h.name)}</div>
          ${h.identity && doneToday ? `<div class="identity-proof">✨ You proved you're a ${escapeHtml(h.identity)} today!</div>` : ''}
          ${h.identity ? `<div class="identity-counter">You've been a ${escapeHtml(h.identity)} for ${getDaysAsIdentity(h)} days</div>` : ''}
          ${h.trigger ? `<div class="habit-trigger">⚡ ${escapeHtml(h.trigger)}</div>` : ''}
          ${showCompoundEffect(h)}
          <div class="small">
            ${isBadHabit ? 'Avoided' : 'Streak'}: <strong>${streak}</strong> ${isBadHabit ? 'days' : ''}
            ${bestStreak > streak ? `<span class="best-streak">• Best: ${bestStreak} 🏆</span>` : ''}
            ${streak >= 30 ? `<span class="streak-milestone">🔥 ${streak} Day Fire!</span>` : ''}
            ${streak >= 7 && streak < 30 ? `<span class="streak-milestone">⚡ ${streak} Days!</span>` : ''}
          </div>
          <div class="weekly-goal">${isBadHabit ? 'Avoided' : 'Completed'}: ${weekProgress.completed}/${weekProgress.goal} days this week (${weekProgress.percentage}%)</div>
          <div class="progress" aria-hidden="true"><i style="width:${Math.round((last7.reduce((a,b)=>a+b,0)/7)*100)}%"></i></div>
        </div>
      </div>
      <div class="controls">
        ${isBadHabit ? `
          <button class="icon-btn js-urge-surf" title="Urge Surfing">🌊 Resist Urge</button>
          <button class="icon-btn js-consequences" title="See Real Cost">💰 Real Cost</button>
          <button class="icon-btn js-log-trigger" title="Log Trigger">📝 Log Trigger</button>
        ` : `
          <button class="icon-btn js-micro" title="Can't do full? Do 10%">🐣 10% Rule</button>
          <button class="icon-btn js-evidence" title="Add Evidence">📸 Photo Proof</button>
        `}
        ${!h.identity ? `<button class="icon-btn js-identity" title="Set Identity">🎯 I Am...</button>` : ''}
        <button class="icon-btn js-view-details" title="View Full Details">📊 Details</button>
        <button class="icon-btn js-toggle">${isBadHabit ? 'Toggle Avoided' : 'Toggle Today'}</button>
        <button class="icon-btn js-note">💭 Note</button>
        <button class="icon-btn js-export">Export</button>
        <button class="icon-btn js-delete" title="Delete">🗑️</button>
      </div>
    `;

// Event handlers
const handleToggle = () => {
    if(isBadHabit && !doneToday){
        // Bad habit friction - add confirmation
        const shouldProceed = addBadHabitFriction(h.id);
        if(shouldProceed){
            toggleToday(h.id);
            // Show celebration with identity reinforcement
            if(h.identity){
                setTimeout(() => showCelebration(
                    `You Proved You're Not That Person!`,
                    `You resisted! You're becoming a ${h.identity}.`
                ), 500);
            }
        }
    } else {
        toggleToday(h.id);
        // Celebration for good habits
        if(!isBadHabit && !doneToday && h.identity){
            setTimeout(() => showCelebration(
                `You Proved Who You Are!`,
                `You're a ${h.identity}. This is who you've become.`
            ), 500);
        }
    }
};

card.querySelector('.js-toggle').addEventListener('click', handleToggle);
card.querySelector('.chk').addEventListener('change', handleToggle);

// Identity setting
card.querySelector('.js-identity')?.addEventListener('click', ()=> showIdentitySelection(h.id));

// View detailed habit modal
card.querySelector('.js-view-details')?.addEventListener('click', ()=> showHabitDetailModal(h.id));

// Micro-commitment (10% rule)
card.querySelector('.js-micro')?.addEventListener('click', ()=> logMicroCommitment(h.id));

// Visceral consequences for bad habits
card.querySelector('.js-consequences')?.addEventListener('click', ()=> showVisceralConsequences(h.id));

// Bad habit specific controls
if(isBadHabit){
    card.querySelector('.js-urge-surf')?.addEventListener('click', ()=> startUrgeSurfing(h.id));
    card.querySelector('.js-log-trigger')?.addEventListener('click', ()=> {
        const triggerType = prompt('What triggered the urge?\n\n1. Time of day\n2. Location\n3. Emotion\n4. Social situation\n5. Other', '');
        if(triggerType){
            const notes = prompt('Additional details (optional):', '');
            logTrigger(h.id, triggerType, notes || '');
            showNotification('📝 Trigger Logged', 'This helps identify patterns');
        }
    });
} else {
    card.querySelector('.js-evidence')?.addEventListener('click', ()=> captureHabitEvidence(h.id));
}

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
        pushUndo('Delete habit', { habit: JSON.parse(JSON.stringify(h)) });
        deleteHabit(h.id);
        showToast(`Deleted: ${h.name}`, 'success', 3000, [{
            id: 'undo',
            label: 'Undo',
            callback: undo
        }]);
    }
});

// Quick action buttons
card.querySelector('.js-quick-edit')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(h.id);
});

card.querySelector('.js-quick-delete')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if(confirm(`Delete "${h.name}"? This cannot be undone.`)){
        pushUndo('Delete habit', { habit: JSON.parse(JSON.stringify(h)) });
        deleteHabit(h.id);
        showToast(`Deleted: ${h.name}`, 'success', 3000, [{
            id: 'undo',
            label: 'Undo',
            callback: undo
        }]);
    }
});

// Bulk select mode
if (bulkSelectMode) {
    card.classList.add('selectable');
    if (selectedHabits.has(h.id)) {
        card.classList.add('bulk-selected');
    }
    
    card.addEventListener('click', (e) => {
        // Don't trigger on button clicks
        if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) {
            return;
        }
        
        e.stopPropagation();
        if (selectedHabits.has(h.id)) {
            selectedHabits.delete(h.id);
            card.classList.remove('bulk-selected');
        } else {
            selectedHabits.add(h.id);
            card.classList.add('bulk-selected');
        }
    });
}

$habits.appendChild(card);
    }
}

// Add quick edit modal function
function openEditModal(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>✏️ Edit Habit</h3>
            <form id="editForm">
                <div class="form-group">
                    <label>Habit Name</label>
                    <input type="text" id="editName" value="${escapeHtml(habit.name)}" required />
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <input type="text" id="editCategory" value="${escapeHtml(habit.category || '')}" />
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select id="editType">
                        <option value="good" ${habit.type !== 'bad' ? 'selected' : ''}>Good Habit</option>
                        <option value="bad" ${habit.type === 'bad' ? 'selected' : ''}>Bad Habit</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Save Changes</button>
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('editName').focus();
    
    document.getElementById('editForm').addEventListener('submit', (e) => {
        e.preventDefault();
        pushUndo('Edit habit', { oldHabit: JSON.parse(JSON.stringify(habit)) });
        habit.name = document.getElementById('editName').value;
        habit.category = document.getElementById('editCategory').value;
        habit.type = document.getElementById('editType').value;
        saveData(state);
        render();
        modal.remove();
        showToast('Habit updated', 'success');
    });
}

//Form Handling
document.getElementById('addForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = document.getElementById('habitName');
    const habitTypeSelect = document.getElementById('habitType');
    const categorySelect = document.getElementById('habitCategory');
    const weeklyGoalInput = document.getElementById('weeklyGoal');
    const triggerInput = document.getElementById('habitTrigger');
    const difficultySelect = document.getElementById('habitDifficulty');
    const replacementInput = document.getElementById('replacementBehavior');
    
    const name = input.value.trim();
    if(!name) return;
    
    const newH = { 
        id: useId(), 
        name, 
        created: todayISO, 
        completions: [],
        type: habitTypeSelect.value,
        category: categorySelect.value,
        weeklyGoal: parseInt(weeklyGoalInput.value) || 7,
        trigger: triggerInput.value.trim() || null,
        difficulty: difficultySelect.value,
        replacementBehavior: replacementInput.value.trim() || null
    };
    
    state.habits.push(newH);
    saveData(state);
    input.value = '';
    triggerInput.value = '';
    replacementInput.value = '';
    render();
    
    // Show tip for new habit
    showNotification('🎉 Habit Added!', `Start small and be consistent with: ${name}`);
});

// Show/hide replacement behavior field based on habit type
document.getElementById('habitType').addEventListener('change', (e) => {
    const replacementRow = document.getElementById('replacementRow');
    if(e.target.value === 'bad'){
        replacementRow.style.display = 'block';
    } else {
        replacementRow.style.display = 'none';
    }
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

// Chart.js instances
let categoryChart = null;
let progressChart = null;

function updateCharts(){
    // Category Success Chart (Pie Chart)
    const categoryData = {};
    state.habits.forEach(h => {
        const cat = h.category || 'other';
        if(!categoryData[cat]) categoryData[cat] = {total: 0, completed: 0};
        
        const created = new Date(h.created);
        const today = new Date();
        const days = Math.floor((today - created) / (1000 * 60 * 60 * 24)) + 1;
        categoryData[cat].total += days;
        categoryData[cat].completed += (h.completions || []).length;
    });
    
    const categoryLabels = Object.keys(categoryData).map(k => {
        const emoji = {'health':'🏃','learning':'📚','productivity':'💼','mindfulness':'🧘','social':'👥','other':'✨'}[k];
        return `${emoji} ${k.charAt(0).toUpperCase() + k.slice(1)}`;
    });
    const categoryPercentages = Object.values(categoryData).map(d => 
        d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
    );
    
    const categoryCtx = document.getElementById('categoryChart');
    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: categoryPercentages,
                backgroundColor: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#94a3b8'],
                borderWidth: 2,
                borderColor: '#0b1220'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {color: '#e6eef6', font: {size: 12}}
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${context.parsed}%`
                    }
                }
            }
        }
    });
    
    // Monthly Progress Chart (Bar Chart - Last 30 days)
    const last30Days = [];
    const completionsByDay = {};
    
    for(let i = 29; i >= 0; i--){
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0,0,0,0);
        const iso = d.toISOString().slice(0,10);
        last30Days.push(iso);
        completionsByDay[iso] = 0;
    }
    
    state.habits.forEach(h => {
        (h.completions || []).forEach(date => {
            if(completionsByDay[date] !== undefined){
                completionsByDay[date]++;
            }
        });
    });
    
    const progressCtx = document.getElementById('progressChart');
    if(progressChart) progressChart.destroy();
    progressChart = new Chart(progressCtx, {
        type: 'bar',
        data: {
            labels: last30Days.map(d => new Date(d).getDate()),
            datasets: [{
                label: 'Habits Completed',
                data: last30Days.map(d => completionsByDay[d]),
                backgroundColor: '#6ee7b7',
                borderColor: '#10b981',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {color: '#94a3b8', stepSize: 1},
                    grid: {color: 'rgba(255,255,255,0.05)'}
                },
                x: {
                    ticks: {color: '#94a3b8'},
                    grid: {color: 'rgba(255,255,255,0.05)'}
                }
            },
            plugins: {
                legend: {
                    labels: {color: '#e6eef6'}
                }
            }
        }
    });
}

function updateGoalsOverview(){
    const goalsDiv = document.getElementById('goalsOverview');
    goalsDiv.innerHTML = '';
    
    state.habits.forEach(h => {
        const progress = getWeekProgress(h);
        const percentage = progress.percentage;
        const status = percentage >= 100 ? '🎉' : percentage >= 75 ? '✅' : percentage >= 50 ? '⚡' : '⏳';
        
        const goalItem = document.createElement('div');
        goalItem.className = 'goal-item';
        goalItem.innerHTML = `
            <div class="goal-item-info">
                <div class="goal-item-title">${escapeHtml(h.name)}</div>
                <div class="goal-item-progress">
                    ${progress.completed}/${progress.goal} days this week (${percentage}%)
                </div>
            </div>
            <div class="goal-item-status">${status}</div>
        `;
        goalsDiv.appendChild(goalItem);
    });
}

// Initial render
console.log('Initializing app with', state.habits.length, 'habits');
render();
showMotivationalQuote();
checkFreshStartOpportunity();

// Initialize tab navigation
initializeTabNavigation();

console.log('App initialized successfully');

// ========================================
// FRESH START EFFECT
// ========================================

function checkFreshStartOpportunity(){
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();
    
    let isFreshStart = false;
    let message = '';
    let title = '';
    
    // Check if Monday
    if(dayOfWeek === 1){
        isFreshStart = true;
        title = '🌅 Fresh Start Monday!';
        message = 'New week, new you! Mondays are scientifically proven to be the best day for fresh starts.';
    }
    
    // Check if 1st of month
    if(dayOfMonth === 1){
        isFreshStart = true;
        title = '🗓️ New Month, New Chapter!';
        message = 'The first day of the month is a powerful psychological reset point. Start strong!';
    }
    
    // Check if user's birthday (stored in profile)
    const userBirthday = currentUser.birthday; // format: MM-DD
    if(userBirthday){
        const [month, day] = userBirthday.split('-').map(Number);
        if(today.getMonth() + 1 === month && today.getDate() === day){
            isFreshStart = true;
            title = '🎂 Happy Birthday - Fresh Start!';
            message = 'Your birthday is the ultimate fresh start. Who will you become this year?';
        }
    }
    
    if(isFreshStart){
        const banner = document.getElementById('freshStartBanner');
        const titleEl = document.getElementById('freshStartTitle');
        const messageEl = document.getElementById('freshStartMessage');
        
        if(banner){
            banner.style.display = 'flex';
            titleEl.textContent = title;
            messageEl.textContent = message;
        }
    }
}

document.getElementById('newChapterBtn')?.addEventListener('click', () => {
    if(confirm('Start a New Chapter? This creates a psychological reset while keeping your data.\n\nYour habits will be marked as "Chapter 2" and you\'ll get renewed motivation!')){
        // Increment chapter counter
        if(!currentUser.chapter) currentUser.chapter = 1;
        currentUser.chapter++;
        
        // Save chapter milestone
        localStorage.setItem('havhabit:session', JSON.stringify(currentUser));
        
        // Show celebration
        showCelebration(
            'New Chapter Begins!',
            `Welcome to Chapter ${currentUser.chapter} of your journey. Your story continues...`
        );
        
        // Hide fresh start banner
        document.getElementById('freshStartBanner').style.display = 'none';
        
        // Award points
        updatePoints(50, 'Started New Chapter');
        unlockAchievement(`chapter_${currentUser.chapter}`, `Chapter ${currentUser.chapter}`, `📖 Started Chapter ${currentUser.chapter} of your habit journey`);
    }
});

// ========================================
// VISUAL IDENTITY REINFORCEMENT
// ========================================

function showIdentitySelection(habitId){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h) return;
    
    const modal = document.getElementById('identityModal');
    modal.style.display = 'flex';
    modal.dataset.habitId = habitId;
    
    // Pre-fill if identity exists
    document.getElementById('habitIdentity').value = h.identity || '';
}

// Identity example buttons
document.querySelectorAll('.identity-example').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('habitIdentity').value = btn.dataset.identity;
    });
});

document.getElementById('saveIdentityBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('identityModal');
    const habitId = modal.dataset.habitId;
    const identity = document.getElementById('habitIdentity').value.trim();
    
    if(!identity) return;
    
    const h = state.habits.find(habit => habit.id === habitId);
    if(h){
        h.identity = identity;
        h.identityStartDate = h.identityStartDate || todayISO;
        saveData(state);
        render();
        
        showCelebration(
            `You Are A ${identity.charAt(0).toUpperCase() + identity.slice(1)}!`,
            `Identity locked in. Every completion proves who you are.`
        );
    }
    
    modal.style.display = 'none';
});

function getDaysAsIdentity(habit){
    if(!habit.identity || !habit.identityStartDate) return 0;
    const start = new Date(habit.identityStartDate);
    const today = new Date();
    return Math.floor((today - start) / (1000 * 60 * 60 * 24));
}

// ========================================
// MICRO-COMMITMENTS (10% RULE)
// ========================================

function logMicroCommitment(habitId){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h) return;
    
    if(!h.microCompletions) h.microCompletions = [];
    
    if(h.microCompletions.includes(todayISO)){
        showNotification('Already Logged', 'You already did the 10% version today!');
        return;
    }
    
    h.microCompletions.push(todayISO);
    saveData(state);
    
    // Award reduced points but keep streak alive
    updatePoints(5, '10% Commitment - Kept the streak alive!');
    
    showCelebration(
        'Something Beats Nothing!',
        `You did the 10% version. The habit loop stays intact. Tomorrow you can do more!`
    );
    
    render();
}

// ========================================
// IMMEDIATE VISCERAL CONSEQUENCES
// ========================================

function showVisceralConsequences(habitId){
    const h = state.habits.find(habit => habit.id === habitId);
    if(!h || h.type !== 'bad') return;
    
    const modal = document.getElementById('consequencesCalculator');
    const breakdown = document.getElementById('costBreakdown');
    const timeTravel = document.getElementById('timeTravelPreview');
    
    // Calculate real costs
    const daysSinceStart = Math.floor((new Date() - new Date(h.created)) / (1000 * 60 * 60 * 24));
    const daysIndulged = daysSinceStart - (h.completions || []).length;
    
    const costPerDay = h.costPerDay || 10; // Default $10/day
    const totalCost = daysIndulged * costPerDay;
    const minutesLost = h.minutesLostPerDay ? daysIndulged * h.minutesLostPerDay : 0;
    const hoursLost = Math.round(minutesLost / 60);
    
    breakdown.innerHTML = `
        <div class=\"cost-item\">
            <div class=\"cost-icon\">💰</div>
            <div class=\"cost-details\">
                <div class=\"cost-value\">$${totalCost.toLocaleString()}</div>
                <div class=\"cost-label\">Total Money Spent</div>
            </div>
        </div>
        <div class=\"cost-item\">
            <div class=\"cost-icon\">⏰</div>
            <div class=\"cost-details\">
                <div class=\"cost-value\">${hoursLost} hours</div>
                <div class=\"cost-label\">Time Lost</div>
            </div>
        </div>
        <div class=\"cost-item\">
            <div class=\"cost-icon\">📅</div>
            <div class=\"cost-details\">
                <div class=\"cost-value\">${daysIndulged} days</div>
                <div class=\"cost-label\">Days Indulged</div>
            </div>
        </div>
    `;
    
    // Time travel preview (90 days)
    const projection90Days = Math.round((costPerDay * 90));
    const projectionYear = Math.round((costPerDay * 365));
    
    timeTravel.innerHTML = `
        <h4>🔮 If You Continue...</h4>
        <div class=\"time-preview\">
            <div class=\"preview-item\">
                <span class=\"preview-time\">In 90 days:</span>
                <span class=\"preview-cost\">-$${projection90Days.toLocaleString()}</span>
            </div>
            <div class=\"preview-item\">
                <span class=\"preview-time\">In 1 year:</span>
                <span class=\"preview-cost\">-$${projectionYear.toLocaleString()}</span>
            </div>
            <div class=\"future-message\">
                ${h.healthImpact ? `<p class=\"health-warning\">⚠️ ${h.healthImpact}</p>` : ''}
                <p class=\"motivation\">But you can change this story. Start today.</p>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

window.closeConsequences = function(){
    document.getElementById('consequencesCalculator').style.display = 'none';
}

// ========================================
// HYPERBOLIC DISCOUNTING COMBAT
// ========================================

function showCompoundEffect(habit){
    if(!habit.compoundValue) return '';
    
    // Examples: "30 min reading = 52 books/year"
    const daily = habit.compoundValue.daily;
    const yearly = habit.compoundValue.yearly;
    
    return `<div class=\"compound-effect\">
        <div class=\"compound-icon\">📈</div>
        <div class=\"compound-text\">
            <strong>Compound Effect:</strong> ${daily} daily = ${yearly} per year
        </div>
    </div>`;
}

// ========================================
// NARRATIVE BUILDING
// ========================================

function getHeroJourneyPhase(){
    const totalHabits = state.habits.length;
    const avgSuccess = calculateLifetimeSuccess().percentage;
    
    if(avgSuccess < 30) return {
        phase: 'Act 1: The Call to Adventure',
        message: 'You\'ve heard the call. The journey has begun. Every hero starts here.',
        emoji: '🌅'
    };
    
    if(avgSuccess < 60) return {
        phase: 'Act 2: The Struggle',
        message: 'You\'re in the hard middle. This is where heroes are forged. Keep pushing!',
        emoji: '⚔️'
    };
    
    return {
        phase: 'Act 3: The Transformation',
        message: 'You\'ve become who you needed to be. The hero\'s journey continues!',
        emoji: '👑'
    };
}

function getBattleStats(){
    const urgesSurfed = analyticsData.urgeSurfLogs?.filter(l => l.success).length || 0;
    const triggersLogged = analyticsData.triggerLogs?.length || 0;
    
    return {
        urgesSurfed,
        triggersLogged,
        battlesWon: urgesSurfed
    };
}

// ========================================
// PEAK-END RULE (CELEBRATIONS)
// ========================================

function showCelebration(title, message){
    const modal = document.getElementById('celebrationModal');
    document.getElementById('celebrationTitle').textContent = title;
    document.getElementById('celebrationMessage').textContent = message;
    
    modal.style.display = 'flex';
    
    // Trigger confetti
    createConfetti();
    
    // Auto-close after 4 seconds
    setTimeout(() => {
        modal.style.display = 'none';
    }, 4000);
}

window.closeCelebration = function(){
    document.getElementById('celebrationModal').style.display = 'none';
}

function createConfetti(){
    const container = document.getElementById('confettiContainer');
    container.innerHTML = '';
    
    const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#fb923c'];
    
    for(let i = 0; i < 50; i++){
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(confetti);
    }
}

// Check for at-risk habits and daily predictions
setTimeout(() => {
    const predictions = predictFailureRisk();
    if(predictions.length > 0 && predictions.some(p => p.risk === 'high')){
        const highRisk = predictions.filter(p => p.risk === 'high');
        showNotification('⚠️ Habits at Risk', 
            `${highRisk.length} habit(s) need attention today!`);
    }
}, 2000);

// Periodic trigger checks (every hour)
setInterval(checkHabitTriggers, 60000 * 60);

// Check for broken streaks and offer post-mortem
setTimeout(() => {
    const atRisk = state.habits.filter(isAtRisk);
    if(atRisk.length > 0 && Math.random() < 0.5){
        // 50% chance to show post-mortem for first at-risk habit
        showPostMortem(atRisk[0].id);
    }
}, 5000);

// Achievement checks
if(gamificationData.points >= 100 && !gamificationData.achievements.find(a => a.id === 'first_100')){
    unlockAchievement('first_100', 'Century!', '💯 Earned your first 100 points');
}

if(state.habits.length >= 5 && !gamificationData.achievements.find(a => a.id === 'habit_collector')){
    unlockAchievement('habit_collector', 'Habit Collector', '🎯 Tracking 5+ habits');
}

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

// ========================================
// NAVIGATION TABS
// ========================================

// ========================================
// TAB NAVIGATION
// ========================================

function initializeTabNavigation(){
    const navTabs = document.querySelectorAll('.nav-tab');
    const currentTab = localStorage.getItem('activeTab') || 'dashboard';

    // Set initial active tab
    const initialTab = document.querySelector(`[data-tab="${currentTab}"]`);
    if(initialTab){
        navTabs.forEach(t => t.classList.remove('active'));
        initialTab.classList.add('active');
        updateTabContent(currentTab);
    }

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Remove active from all tabs
            navTabs.forEach(t => t.classList.remove('active'));
            
            // Add active to clicked tab
            tab.classList.add('active');
            
            // Save preference
            localStorage.setItem('activeTab', tabName);
            
            // Update content
            updateTabContent(tabName);
        });
    });
}

function updateTabContent(tab){
    // Hide all sections first
    const gamificationSection = document.getElementById('gamificationSection');
    const freshStartBanner = document.getElementById('freshStartBanner');
    const insightsContainer = document.getElementById('insightsContainer');
    const analyticsDashboard = document.getElementById('analyticsDashboard');
    const addHabitSection = document.querySelector('.add-habit-section');
    const habitsSection = document.querySelector('.habits-section');
    const successBanner = document.querySelector('.success-banner');
    
    switch(tab){
        case 'dashboard':
            // Show main dashboard
            if(successBanner) successBanner.style.display = 'block';
            if(addHabitSection) addHabitSection.style.display = 'block';
            if(habitsSection) habitsSection.style.display = 'block';
            if(gamificationSection && (gamificationData.points > 0 || gamificationData.achievements.length > 0)){
                gamificationSection.style.display = 'block';
            } else if(gamificationSection){
                gamificationSection.style.display = 'none';
            }
            if(freshStartBanner) freshStartBanner.style.display = freshStartBanner.dataset.shown === 'true' ? 'flex' : 'none';
            if(insightsContainer) insightsContainer.style.display = 'none';
            if(analyticsDashboard) analyticsDashboard.style.display = 'none';
            break;
            
        case 'analytics':
            // Show analytics
            if(successBanner) successBanner.style.display = 'none';
            if(addHabitSection) addHabitSection.style.display = 'none';
            if(habitsSection) habitsSection.style.display = 'none';
            if(gamificationSection) gamificationSection.style.display = 'none';
            if(freshStartBanner) freshStartBanner.style.display = 'none';
            if(insightsContainer) insightsContainer.style.display = 'grid';
            if(analyticsDashboard) analyticsDashboard.style.display = 'grid';
            updateCharts();
            updateGoalsOverview();
            break;
            
        case 'achievements':
            // Show achievements and gamification
            if(successBanner) successBanner.style.display = 'none';
            if(addHabitSection) addHabitSection.style.display = 'none';
            if(habitsSection) habitsSection.style.display = 'none';
            if(gamificationSection) gamificationSection.style.display = 'block';
            if(freshStartBanner) freshStartBanner.style.display = 'none';
            if(insightsContainer) insightsContainer.style.display = 'none';
            if(analyticsDashboard) analyticsDashboard.style.display = 'none';
            updateAchievementsDisplay();
            updateHabitGarden();
            break;
            
        case 'insights':
            // Show insights and contextual tips
            if(successBanner) successBanner.style.display = 'block';
            if(addHabitSection) addHabitSection.style.display = 'none';
            if(habitsSection) habitsSection.style.display = 'none';
            if(gamificationSection) gamificationSection.style.display = 'none';
            if(freshStartBanner) freshStartBanner.style.display = 'none';
            if(insightsContainer) insightsContainer.style.display = 'grid';
            if(analyticsDashboard) analyticsDashboard.style.display = 'none';
            
            // Show hero journey phase
            const heroPhase = getHeroJourneyPhase();
            const battleStats = getBattleStats();
            const tipEl = document.getElementById('contextualTip');
            if(tipEl){
                tipEl.innerHTML = `
                    <div class="tip-insight">
                        <h3>${heroPhase.emoji} ${heroPhase.phase}</h3>
                        <p>${heroPhase.message}</p>
                        <div style="margin-top:16px;">
                            <strong>Your Battle Stats:</strong><br>
                            ⚔️ Urges Resisted: ${battleStats.urgesSurfed}<br>
                            📝 Triggers Logged: ${battleStats.triggersLogged}<br>
                            🏆 Battles Won: ${battleStats.battlesWon}
                        </div>
                    </div>
                `;
            }
            
            // Display personalized insights from onboarding
            displayPersonalizedInsights();
            break;
    }
}

// Load and display user profile insights
function displayPersonalizedInsights() {
    const user = getCurrentUser();
    if (!user) return;
    
    const profileData = localStorage.getItem(`userProfile:${user.id}`);
    if (!profileData) return;
    
    try {
        const profile = JSON.parse(profileData);
        const insightsContainer = document.getElementById('insightsContainer');
        if (!insightsContainer) return;
        
        // Create personalized insights section
        let personalizedHTML = `
            <div class="profile-insights-card">
                <h3>🎯 Your Personalized Journey</h3>
                
                <div class="insight-section">
                    <h4>💪 Your Strength</h4>
                    <p><strong>${profile.proudHabit}</strong></p>
                    <p class="insight-tip">Keep this going! It's proof you can build lasting habits.</p>
                </div>
                
                <div class="insight-section">
                    <h4>🔧 Your Focus</h4>
                    <p><strong>${profile.improveHabit}</strong></p>
                    <p class="insight-tip">Primary area: <span class="tag">${profile.primaryFocus}</span></p>
                </div>
                
                <div class="insight-section">
                    <h4>💰 Financial Connection</h4>
                    <p><strong>Goal:</strong> ${profile.financialGoal}</p>
        `;
        
        if (profile.financialHabitLink && profile.financialHabitLink.length > 0) {
            profile.financialHabitLink.forEach(link => {
                personalizedHTML += `
                    <div class="financial-link">
                        <p><strong>${link.connection}</strong></p>
                        <p class="impact">${link.potentialImpact}</p>
                    </div>
                `;
            });
        }
        
        personalizedHTML += `
                </div>
                
                <div class="insight-section">
                    <h4>🌟 Your Identity</h4>
                    <div class="identity-tags">
        `;
        
        if (profile.personalizedIdentity && profile.personalizedIdentity.length > 0) {
            profile.personalizedIdentity.forEach(identity => {
                personalizedHTML += `<span class="identity-tag">${identity}</span>`;
            });
        }
        
        personalizedHTML += `
                    </div>
                </div>
                
                <div class="insight-section vision-section">
                    <h4>🚀 Your Vision (1 Year)</h4>
                    <blockquote>${escapeHtml(profile.futureVision)}</blockquote>
                </div>
                
                <div class="insight-section">
                    <h4>📊 Current State</h4>
                    <div class="motivation-meter">
                        <label>Motivation Level:</label>
                        <div class="meter-bar">
                            <div class="meter-fill" style="width: ${profile.motivationLevel}%"></div>
                        </div>
                        <span class="meter-value">${profile.motivationLevel}%</span>
                    </div>
                    <p class="insight-tip">Feeling: <strong>${profile.currentMood}</strong></p>
                </div>
            </div>
        `;
        
        // Insert at the beginning of insights container
        const existingContent = insightsContainer.innerHTML;
        insightsContainer.innerHTML = personalizedHTML + existingContent;
        
    } catch(e) {
        console.error('Error displaying profile insights:', e);
    }
}

// Initialize suggested habits from onboarding
function initializeSuggestedHabits() {
    const user = getCurrentUser();
    if (!user) return;
    
    const profileData = localStorage.getItem(`userProfile:${user.id}`);
    if (!profileData) return;
    
    try {
        const profile = JSON.parse(profileData);
        
        // Check if we've already initialized suggested habits
        const initialized = localStorage.getItem(`suggestedHabits:${user.id}:initialized`);
        if (initialized === 'true') return;
        
        // Add suggested habits to the state
        if (profile.suggestedHabits && profile.suggestedHabits.length > 0) {
            profile.suggestedHabits.forEach(suggestion => {
                const newHabit = {
                    id: useId(),
                    name: suggestion.name,
                    type: suggestion.type === 'quit' ? 'bad' : 'good',
                    streak: 0,
                    completions: [],
                    notes: `Suggested based on your onboarding: ${suggestion.reason}`,
                    category: suggestion.category,
                    priority: suggestion.priority
                };
                state.habits.push(newHabit);
            });
            
            saveData(state);
            localStorage.setItem(`suggestedHabits:${user.id}:initialized`, 'true');
            render();
        }
    } catch(e) {
        console.error('Error initializing suggested habits:', e);
    }
}

// Call initialization on page load
initializeSuggestedHabits();

// ================================
// UX ENHANCEMENTS
// ================================

// Undo/Redo System
const undoStack = [];
const MAX_UNDO_HISTORY = 20;

function createUndoState(action, data) {
    return {
        action,
        data,
        timestamp: Date.now(),
        state: JSON.parse(JSON.stringify(state)) // Deep clone current state
    };
}

function pushUndo(action, data) {
    undoStack.push(createUndoState(action, data));
    if (undoStack.length > MAX_UNDO_HISTORY) {
        undoStack.shift();
    }
}

function undo() {
    if (undoStack.length === 0) {
        showToast('Nothing to undo', 'info');
        return;
    }
    
    const undoState = undoStack.pop();
    state = undoState.state;
    saveData(state);
    render();
    showToast(`Undone: ${undoState.action}`, 'success');
}

// Toast Notification System
function showToast(message, type = 'info', duration = 3000, actions = []) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    }[type] || 'ℹ️';
    
    let actionsHTML = '';
    if (actions.length > 0) {
        actionsHTML = '<div class="toast-actions">';
        actions.forEach(action => {
            actionsHTML += `<button class="toast-action" data-action="${action.id}">${action.label}</button>`;
        });
        actionsHTML += '</div>';
    }
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        ${actionsHTML}
    `;
    
    document.body.appendChild(toast);
    
    // Handle action clicks
    toast.querySelectorAll('.toast-action').forEach(btn => {
        btn.addEventListener('click', () => {
            const actionId = btn.dataset.action;
            const action = actions.find(a => a.id === actionId);
            if (action && action.callback) {
                action.callback();
            }
            toast.remove();
        });
    });
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Keyboard Shortcuts
let selectedHabitIndex = -1;
let bulkSelectMode = false;
const selectedHabits = new Set();

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        const key = e.key.toLowerCase();
        
        // Tab switching: 1-4
        if (['1', '2', '3', '4'].includes(key)) {
            const tabs = ['dashboard', 'analytics', 'achievements', 'insights'];
            const tabIndex = parseInt(key) - 1;
            if (tabs[tabIndex]) {
                updateTabContent(tabs[tabIndex]);
                document.querySelectorAll('.nav-tab').forEach((tab, i) => {
                    tab.classList.toggle('active', i === tabIndex);
                });
            }
            e.preventDefault();
            return;
        }
        
        // New habit: N
        if (key === 'n') {
            document.getElementById('habitName')?.focus();
            document.querySelector('.add-habit-section')?.scrollIntoView({ behavior: 'smooth' });
            e.preventDefault();
            return;
        }
        
        // Undo: Ctrl+Z or Cmd+Z
        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
            undo();
            e.preventDefault();
            return;
        }
        
        // Bulk select mode: Shift
        if (e.shiftKey && !bulkSelectMode) {
            bulkSelectMode = true;
            document.body.classList.add('bulk-select-mode');
            showToast('Bulk select mode ON. Click habits to select.', 'info');
        }
        
        // Escape: Clear selection / Exit bulk mode
        if (key === 'escape') {
            if (bulkSelectMode) {
                exitBulkSelectMode();
                e.preventDefault();
            }
        }
        
        // Space: Toggle first habit or selected habit
        if (key === ' ') {
            if (state.habits.length > 0) {
                const targetIndex = selectedHabitIndex >= 0 ? selectedHabitIndex : 0;
                if (state.habits[targetIndex]) {
                    toggleToday(state.habits[targetIndex].id);
                    showToast(`Toggled: ${state.habits[targetIndex].name}`, 'success');
                }
            }
            e.preventDefault();
            return;
        }
        
        // Arrow navigation
        if (['arrowup', 'arrowdown'].includes(key)) {
            if (state.habits.length === 0) return;
            
            if (key === 'arrowdown') {
                selectedHabitIndex = Math.min(selectedHabitIndex + 1, state.habits.length - 1);
            } else {
                selectedHabitIndex = Math.max(selectedHabitIndex - 1, 0);
            }
            
            highlightSelectedHabit();
            e.preventDefault();
            return;
        }
        
        // Delete selected: D
        if (key === 'd' && selectedHabitIndex >= 0) {
            const habit = state.habits[selectedHabitIndex];
            if (habit) {
                pushUndo('Delete habit', { habit });
                deleteHabit(habit.id);
                showToast(`Deleted: ${habit.name}`, 'success', 3000, [{
                    id: 'undo',
                    label: 'Undo',
                    callback: undo
                }]);
            }
            e.preventDefault();
            return;
        }
        
        // Edit selected: E
        if (key === 'e' && selectedHabitIndex >= 0) {
            const habit = state.habits[selectedHabitIndex];
            if (habit) {
                openEditModal(habit.id);
            }
            e.preventDefault();
            return;
        }
        
        // Bulk actions when in bulk mode
        if (bulkSelectMode && selectedHabits.size > 0) {
            // Complete all selected: C
            if (key === 'c') {
                bulkComplete();
                e.preventDefault();
                return;
            }
            
            // Delete all selected: Delete or Backspace
            if (key === 'delete' || key === 'backspace') {
                bulkDelete();
                e.preventDefault();
                return;
            }
        }
        
        // Show shortcuts help: ?
        if (key === '?' || (e.shiftKey && key === '/')) {
            showKeyboardShortcutsHelp();
            e.preventDefault();
            return;
        }
    });
    
    // Exit bulk mode when Shift is released
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift' && bulkSelectMode) {
            // Don't exit immediately, let user keep selecting
        }
    });
}

function highlightSelectedHabit() {
    document.querySelectorAll('.habit-card').forEach((card, index) => {
        card.classList.toggle('keyboard-selected', index === selectedHabitIndex);
    });
    
    // Scroll into view
    const cards = document.querySelectorAll('.habit-card');
    if (cards[selectedHabitIndex]) {
        cards[selectedHabitIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function exitBulkSelectMode() {
    bulkSelectMode = false;
    selectedHabits.clear();
    document.body.classList.remove('bulk-select-mode');
    document.querySelectorAll('.habit-card').forEach(card => {
        card.classList.remove('bulk-selected');
    });
    showToast('Bulk select mode OFF', 'info');
}

function bulkComplete() {
    let count = 0;
    selectedHabits.forEach(habitId => {
        const habit = state.habits.find(h => h.id === habitId);
        if (habit && !isDoneToday(habit)) {
            toggleToday(habitId);
            count++;
        }
    });
    showToast(`Completed ${count} habits`, 'success');
    exitBulkSelectMode();
}

function bulkDelete() {
    if (!confirm(`Delete ${selectedHabits.size} selected habits?`)) return;
    
    pushUndo('Bulk delete', { habitIds: Array.from(selectedHabits) });
    
    selectedHabits.forEach(habitId => {
        deleteHabit(habitId);
    });
    
    showToast(`Deleted ${selectedHabits.size} habits`, 'success', 3000, [{
        id: 'undo',
        label: 'Undo',
        callback: undo
    }]);
    
    exitBulkSelectMode();
}

function showKeyboardShortcutsHelp() {
    const shortcuts = [
        { key: '1-4', desc: 'Switch between tabs' },
        { key: 'N', desc: 'New habit (focus form)' },
        { key: 'Space', desc: 'Toggle selected habit' },
        { key: '↑/↓', desc: 'Navigate habits' },
        { key: 'E', desc: 'Edit selected habit' },
        { key: 'D', desc: 'Delete selected habit' },
        { key: 'Shift', desc: 'Enter bulk select mode' },
        { key: 'C', desc: 'Complete selected (bulk mode)' },
        { key: 'Esc', desc: 'Exit bulk mode' },
        { key: 'Ctrl+Z', desc: 'Undo last action' },
        { key: '?', desc: 'Show this help' }
    ];
    
    let html = '<div class="shortcuts-help"><h3>⌨️ Keyboard Shortcuts</h3><div class="shortcuts-list">';
    shortcuts.forEach(s => {
        html += `<div class="shortcut-item"><kbd>${s.key}</kbd><span>${s.desc}</span></div>`;
    });
    html += '</div></div>';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-content">${html}<button onclick="this.closest('.modal-overlay').remove()" class="btn-primary">Got it!</button></div>`;
    document.body.appendChild(modal);
}

// Smart Form Enhancements
function initSmartForm() {
    const form = document.getElementById('addForm');
    const nameInput = document.getElementById('habitName');
    const categoryInput = document.getElementById('habitCategory');
    
    if (!form || !nameInput) return;
    
    // Autofocus on page load
    setTimeout(() => nameInput.focus(), 500);
    
    // Enter to submit
    form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.querySelector('button[type="submit"]')?.click();
        }
    });
    
    // Smart category suggestions as you type
    if (categoryInput) {
        const commonCategories = ['Health', 'Fitness', 'Productivity', 'Learning', 'Finance', 'Social', 'Mindfulness', 'Creative'];
        const datalist = document.createElement('datalist');
        datalist.id = 'category-suggestions';
        commonCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist.appendChild(option);
        });
        categoryInput.setAttribute('list', 'category-suggestions');
        categoryInput.parentNode.appendChild(datalist);
    }
    
    // Smart habit name suggestions based on keywords
    nameInput.addEventListener('input', debounce(() => {
        const value = nameInput.value.toLowerCase();
        if (value.length < 3) return;
        
        const suggestions = getHabitSuggestions(value);
        if (suggestions.length > 0) {
            showInlineSuggestions(nameInput, suggestions);
        }
    }, 300));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getHabitSuggestions(keyword) {
    const templates = {
        'water': { name: 'Drink 8 glasses of water', type: 'good', category: 'Health' },
        'exercise': { name: 'Exercise for 30 minutes', type: 'good', category: 'Fitness' },
        'read': { name: 'Read for 20 minutes', type: 'good', category: 'Learning' },
        'meditate': { name: 'Meditate for 10 minutes', type: 'good', category: 'Mindfulness' },
        'sleep': { name: 'Sleep 8 hours', type: 'good', category: 'Health' },
        'journal': { name: 'Write in journal', type: 'good', category: 'Mindfulness' },
        'walk': { name: 'Take a 15-minute walk', type: 'good', category: 'Fitness' },
        'code': { name: 'Code for 1 hour', type: 'good', category: 'Learning' },
        'smoking': { name: 'Avoid smoking', type: 'bad', category: 'Health' },
        'social': { name: 'Avoid social media before bed', type: 'bad', category: 'Productivity' },
        'junk': { name: 'Avoid junk food', type: 'bad', category: 'Health' }
    };
    
    const matches = [];
    for (const [key, template] of Object.entries(templates)) {
        if (key.includes(keyword) || keyword.includes(key)) {
            matches.push(template);
        }
    }
    
    return matches;
}

function showInlineSuggestions(input, suggestions) {
    // Remove existing suggestions
    document.querySelectorAll('.habit-suggestions').forEach(el => el.remove());
    
    const container = document.createElement('div');
    container.className = 'habit-suggestions';
    
    suggestions.slice(0, 3).forEach(suggestion => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'suggestion-btn';
        btn.innerHTML = `💡 ${suggestion.name} <span class="suggestion-meta">${suggestion.category}</span>`;
        btn.addEventListener('click', () => {
            document.getElementById('habitName').value = suggestion.name;
            document.getElementById('habitType').value = suggestion.type;
            document.getElementById('habitCategory').value = suggestion.category;
            container.remove();
        });
        container.appendChild(btn);
    });
    
    input.parentNode.appendChild(container);
}

// Initialize all UX enhancements
initKeyboardShortcuts();
initSmartForm();

// Habit Detail View Modal
function showHabitDetailModal(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const streak = computeStreak(habit);
    const bestStreak = computeBestStreak(habit);
    const completions = habit.completions || [];
    const totalCompletions = completions.length;
    const isBadHabit = habit.type === 'bad';
    
    // Calculate statistics
    const last30Days = getCompletionsInRange(habit, 30);
    const last7Days = getCompletionsInRange(habit, 7);
    const successRate30 = ((last30Days.length / 30) * 100).toFixed(1);
    const successRate7 = ((last7Days.length / 7) * 100).toFixed(1);
    
    // Get failure patterns
    const failures = getFailurePatterns(habit);
    
    // Build calendar view
    const calendarHTML = buildMiniCalendar(habit);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay habit-detail-modal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2>📊 ${escapeHtml(habit.name)}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            
            <div class="habit-detail-grid">
                <!-- Stats Overview -->
                <div class="detail-section">
                    <h3>📈 Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-value">${streak}</div>
                            <div class="stat-label">Current Streak</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${bestStreak}</div>
                            <div class="stat-label">Best Streak</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${totalCompletions}</div>
                            <div class="stat-label">Total ${isBadHabit ? 'Avoided' : 'Completed'}</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${successRate30}%</div>
                            <div class="stat-label">30-Day Success</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${successRate7}%</div>
                            <div class="stat-label">7-Day Success</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${getDaysAsIdentity(habit)}</div>
                            <div class="stat-label">Days as Identity</div>
                        </div>
                    </div>
                </div>
                
                <!-- Calendar View -->
                <div class="detail-section">
                    <h3>📅 Completion History</h3>
                    <div class="habit-calendar">
                        ${calendarHTML}
                    </div>
                    <div class="calendar-legend">
                        <span><span class="legend-box completed"></span> Completed</span>
                        <span><span class="legend-box missed"></span> Missed</span>
                        <span><span class="legend-box future"></span> Future</span>
                    </div>
                </div>
                
                <!-- Failure Patterns -->
                ${failures.length > 0 ? `
                <div class="detail-section">
                    <h3>⚠️ Failure Patterns</h3>
                    <div class="failure-list">
                        ${failures.map(f => `
                            <div class="failure-item">
                                <strong>${f.pattern}</strong>: Failed ${f.count} times
                                ${f.suggestion ? `<p class="suggestion">💡 ${f.suggestion}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- Quick Actions -->
                <div class="detail-section">
                    <h3>⚡ Quick Actions</h3>
                    <div class="detail-actions">
                        <button class="btn-action" onclick="exportHabitData('${habit.id}')">
                            📊 Export Data
                        </button>
                        <button class="btn-action" onclick="shareHabitProgress('${habit.id}')">
                            📤 Share Progress
                        </button>
                        ${streak > 0 ? `
                        <button class="btn-action btn-warning" onclick="freezeStreak('${habit.id}')">
                            ❄️ Freeze Streak (1 day)
                        </button>
                        ` : ''}
                        <button class="btn-action btn-danger" onclick="if(confirm('Delete this habit?')) { deleteHabit('${habit.id}'); this.closest('.modal-overlay').remove(); }">
                            🗑️ Delete Habit
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function buildMiniCalendar(habit) {
    const today = new Date();
    const days = [];
    
    // Show last 42 days (6 weeks)
    for (let i = 41; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        
        const isCompleted = (habit.completions || []).includes(dateStr);
        const isFuture = date > today;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = date.getDate();
        
        let className = 'calendar-day';
        if (isFuture) className += ' future';
        else if (isCompleted) className += ' completed';
        else className += ' missed';
        
        days.push(`
            <div class="${className}" title="${dateStr}${isCompleted ? ' - Completed' : ''}">
                <div class="day-name">${dayName}</div>
                <div class="day-num">${dayNum}</div>
            </div>
        `);
    }
    
    return `<div class="calendar-grid">${days.join('')}</div>`;
}

function getCompletionsInRange(habit, days) {
    const today = new Date();
    const completions = habit.completions || [];
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - days);
    
    return completions.filter(dateStr => {
        const date = new Date(dateStr);
        return date >= rangeStart && date <= today;
    });
}

function getFailurePatterns(habit) {
    const patterns = [];
    const completions = habit.completions || [];
    
    if (completions.length < 7) return patterns;
    
    // Analyze day of week patterns
    const dayStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        const dayOfWeek = date.getDay();
        
        if (!completions.includes(dateStr)) {
            dayStats[dayOfWeek]++;
        }
    }
    
    // Find problematic days
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const maxFailures = Math.max(...Object.values(dayStats));
    
    if (maxFailures >= 3) {
        Object.entries(dayStats).forEach(([day, failures]) => {
            if (failures >= 3) {
                patterns.push({
                    pattern: `${dayNames[day]}s are difficult`,
                    count: failures,
                    suggestion: `Set a reminder for ${dayNames[day]}s or adjust your routine`
                });
            }
        });
    }
    
    // Check for weekend struggles
    const weekendFailures = dayStats[0] + dayStats[6];
    const weekdayFailures = dayStats[1] + dayStats[2] + dayStats[3] + dayStats[4] + dayStats[5];
    
    if (weekendFailures > weekdayFailures * 0.6) {
        patterns.push({
            pattern: 'Weekend struggles',
            count: weekendFailures,
            suggestion: 'Plan weekend activities in advance to maintain consistency'
        });
    }
    
    return patterns;
}

function exportHabitData(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const csv = habitToCSV(habit);
    downloadFile(csv, `${sanitizeFilename(habit.name)}_detailed.csv`, 'text/csv');
    showToast('Habit data exported', 'success');
}

function shareHabitProgress(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const streak = computeStreak(habit);
    const total = (habit.completions || []).length;
    const text = `I've been working on "${habit.name}" 🎯\n\nCurrent streak: ${streak} days 🔥\nTotal completions: ${total}\n\nBuilding better habits with HavHabit!`;
    
    if (navigator.share) {
        navigator.share({
            title: 'My Habit Progress',
            text: text
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text);
        showToast('Progress copied to clipboard!', 'success');
    }
}

function freezeStreak(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    habit.streakFrozen = true;
    habit.frozenUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    saveData(state);
    showToast('Streak frozen for 1 day! ❄️', 'success');
    render();
}

// ================================
// INITIALIZE NATIVE APP FEATURES
// ================================

// Wait for Capacitor to load, then initialize
if (window.nativeApp) {
    // Already loaded via module
    window.nativeApp.init().then(() => {
        console.log('Native app features initialized');
    }).catch(err => {
        console.log('Native init failed (running as web):', err);
    });
} else {
    // Wait for module to load
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (window.nativeApp) {
                window.nativeApp.init().catch(() => {});
            }
        }, 100);
    });
}