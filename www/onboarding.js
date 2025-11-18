// Onboarding state
let currentQuestion = 1;
const totalQuestions = 5;

const onboardingData = {
    proudHabit: '',
    improveHabit: '',
    financialGoal: '',
    currentMood: '',
    futureVision: ''
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateProgress();
    attachEventListeners();
});

function attachEventListeners() {
    // Next button
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    
    // Back button
    document.getElementById('backBtn').addEventListener('click', previousQuestion);
    
    // Finish button
    document.getElementById('finishBtn').addEventListener('click', finishOnboarding);
    
    // Quick picks for all questions
    document.querySelectorAll('.quick-pick').forEach(btn => {
        btn.addEventListener('click', function() {
            const parent = this.closest('.question-card');
            const questionNum = parent.dataset.question;
            
            // Deselect all in this question
            parent.querySelectorAll('.quick-pick').forEach(b => b.classList.remove('selected'));
            
            // Select this one
            this.classList.add('selected');
            
            // Store the value
            const value = this.dataset.value;
            storeAnswer(questionNum, value);
            
            // Clear custom input
            const customInput = parent.querySelector('.custom-input');
            if (customInput) customInput.value = '';
        });
    });
    
    // Mood buttons
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const parent = this.closest('.question-card');
            
            // Deselect all moods
            parent.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
            
            // Select this one
            this.classList.add('selected');
            
            // Store the value
            const value = this.dataset.value;
            onboardingData.currentMood = value;
        });
    });
    
    // Custom inputs
    document.getElementById('proudHabit').addEventListener('input', function() {
        onboardingData.proudHabit = this.value;
        // Deselect quick picks
        document.querySelector('[data-question="1"]').querySelectorAll('.quick-pick').forEach(b => b.classList.remove('selected'));
    });
    
    document.getElementById('improveHabit').addEventListener('input', function() {
        onboardingData.improveHabit = this.value;
        document.querySelector('[data-question="2"]').querySelectorAll('.quick-pick').forEach(b => b.classList.remove('selected'));
    });
    
    document.getElementById('financialGoal').addEventListener('input', function() {
        onboardingData.financialGoal = this.value;
        document.querySelector('[data-question="3"]').querySelectorAll('.quick-pick').forEach(b => b.classList.remove('selected'));
    });
    
    document.getElementById('futureVision').addEventListener('input', function() {
        onboardingData.futureVision = this.value;
    });
}

function storeAnswer(questionNum, value) {
    switch(questionNum) {
        case '1':
            onboardingData.proudHabit = value;
            break;
        case '2':
            onboardingData.improveHabit = value;
            break;
        case '3':
            onboardingData.financialGoal = value;
            break;
    }
}

function nextQuestion() {
    if (!validateCurrentQuestion()) {
        showValidationError();
        return;
    }
    
    if (currentQuestion < totalQuestions) {
        currentQuestion++;
        updateQuestionDisplay();
        updateProgress();
        updateButtons();
    }
}

function previousQuestion() {
    if (currentQuestion > 1) {
        currentQuestion--;
        updateQuestionDisplay();
        updateProgress();
        updateButtons();
    }
}

function validateCurrentQuestion() {
    switch(currentQuestion) {
        case 1:
            return onboardingData.proudHabit !== '';
        case 2:
            return onboardingData.improveHabit !== '';
        case 3:
            return onboardingData.financialGoal !== '';
        case 4:
            return onboardingData.currentMood !== '';
        case 5:
            return onboardingData.futureVision.trim() !== '';
        default:
            return false;
    }
}

function showValidationError() {
    const currentCard = document.querySelector(`.question-card[data-question="${currentQuestion}"]`);
    currentCard.style.animation = 'shake 0.5s';
    setTimeout(() => {
        currentCard.style.animation = '';
    }, 500);
}

function updateQuestionDisplay() {
    document.querySelectorAll('.question-card').forEach(card => {
        card.classList.remove('active');
    });
    
    document.querySelector(`.question-card[data-question="${currentQuestion}"]`).classList.add('active');
}

function updateProgress() {
    const progress = (currentQuestion / totalQuestions) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
}

function updateButtons() {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');
    
    // Show/hide back button
    backBtn.style.display = currentQuestion > 1 ? 'block' : 'none';
    
    // Show next or finish button
    if (currentQuestion === totalQuestions) {
        nextBtn.style.display = 'none';
        finishBtn.style.display = 'block';
    } else {
        nextBtn.style.display = 'block';
        finishBtn.style.display = 'none';
    }
}

function finishOnboarding() {
    if (!validateCurrentQuestion()) {
        showValidationError();
        return;
    }
    
    // Get current user
    const session = localStorage.getItem('havhabit:session');
    if (!session) {
        alert('Session expired. Please log in again.');
        window.location.href = 'login.html';
        return;
    }
    
    const user = JSON.parse(session);
    
    // Calculate profile based on answers
    const userProfile = generateUserProfile();
    
    // Store profile with user ID
    localStorage.setItem(`userProfile:${user.id}`, JSON.stringify(userProfile));
    localStorage.setItem(`onboarding:${user.id}:completed`, 'true');
    
    // Show success animation
    showSuccessMessage();
    
    // Redirect to main app after 2 seconds
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}

function generateUserProfile() {
    const profile = {
        // Store raw answers
        proudHabit: onboardingData.proudHabit,
        improveHabit: onboardingData.improveHabit,
        financialGoal: onboardingData.financialGoal,
        currentMood: onboardingData.currentMood,
        futureVision: onboardingData.futureVision,
        
        // Calculate derived attributes
        motivationLevel: calculateMotivationLevel(),
        primaryFocus: determinePrimaryFocus(),
        financialHabitLink: linkFinancialGoalToHabits(),
        personalizedIdentity: generateIdentity(),
        suggestedHabits: generateSuggestedHabits(),
        
        // Metadata
        onboardingDate: new Date().toISOString(),
        profileVersion: '1.0'
    };
    
    return profile;
}

function calculateMotivationLevel() {
    // Based on mood and vision clarity
    let level = 50; // baseline
    
    const moodScores = {
        'Amazing': 100,
        'Good': 75,
        'Okay': 50,
        'Struggling': 30,
        'Overwhelmed': 20
    };
    
    level = moodScores[onboardingData.currentMood] || 50;
    
    // Boost if vision is detailed (longer answer)
    if (onboardingData.futureVision.length > 100) {
        level = Math.min(100, level + 15);
    }
    
    return level;
}

function determinePrimaryFocus() {
    const improve = onboardingData.improveHabit.toLowerCase();
    
    if (improve.includes('scroll') || improve.includes('phone') || improve.includes('social')) {
        return 'digital-wellness';
    } else if (improve.includes('eat') || improve.includes('food') || improve.includes('snack')) {
        return 'nutrition';
    } else if (improve.includes('exercise') || improve.includes('workout') || improve.includes('fitness')) {
        return 'fitness';
    } else if (improve.includes('sleep')) {
        return 'sleep';
    } else if (improve.includes('procrastination') || improve.includes('focus')) {
        return 'productivity';
    } else if (improve.includes('spend') || improve.includes('money') || improve.includes('shopping')) {
        return 'financial';
    } else {
        return 'general-improvement';
    }
}

function linkFinancialGoalToHabits() {
    const financial = onboardingData.financialGoal.toLowerCase();
    const improve = onboardingData.improveHabit.toLowerCase();
    
    const links = [];
    
    // Direct financial habits
    if (improve.includes('spend') || improve.includes('shopping') || improve.includes('buying')) {
        if (financial.includes('save') || financial.includes('emergency')) {
            links.push({
                habit: onboardingData.improveHabit,
                goal: onboardingData.financialGoal,
                connection: 'Stopping overspending directly helps you save',
                potentialImpact: 'Could save $100-500+ per month'
            });
        }
    }
    
    // Indirect connections
    if (improve.includes('eat') && financial.includes('save')) {
        links.push({
            habit: 'Reducing late-night eating',
            goal: onboardingData.financialGoal,
            connection: 'Meal planning and avoiding delivery saves money',
            potentialImpact: 'Save $150-300/month on food costs'
        });
    }
    
    if (improve.includes('smoke') && financial.includes('save')) {
        links.push({
            habit: 'Quitting smoking',
            goal: onboardingData.financialGoal,
            connection: 'Smoking costs $200-400/month on average',
            potentialImpact: 'Save $2,400-4,800 per year'
        });
    }
    
    return links;
}

function generateIdentity() {
    const proud = onboardingData.proudHabit.toLowerCase();
    const financial = onboardingData.financialGoal.toLowerCase();
    
    const identities = [];
    
    // Based on proud habit
    if (proud.includes('exercise') || proud.includes('workout')) {
        identities.push('I am an athlete');
    }
    if (proud.includes('read')) {
        identities.push('I am a learner');
    }
    if (proud.includes('meditat')) {
        identities.push('I am mindful');
    }
    if (proud.includes('sleep')) {
        identities.push('I prioritize my health');
    }
    
    // Based on financial goal
    if (financial.includes('save') || financial.includes('emergency')) {
        identities.push('I am financially responsible');
    }
    if (financial.includes('invest')) {
        identities.push('I am building wealth');
    }
    if (financial.includes('debt')) {
        identities.push('I am becoming debt-free');
    }
    
    return identities;
}

function generateSuggestedHabits() {
    const suggestions = [];
    const focus = determinePrimaryFocus();
    
    // Pre-populate first habit based on what they want to improve
    suggestions.push({
        name: `Track: ${onboardingData.improveHabit}`,
        type: 'quit',
        category: focus,
        frequency: 'daily',
        priority: 'high',
        reason: 'This is the habit you identified wanting to change'
    });
    
    // Add the habit they're proud of to reinforce it
    suggestions.push({
        name: onboardingData.proudHabit,
        type: 'build',
        category: 'existing-strength',
        frequency: 'daily',
        priority: 'medium',
        reason: 'Keep reinforcing this positive habit!'
    });
    
    // Add a financial tracking habit if they have a financial goal
    if (onboardingData.financialGoal) {
        suggestions.push({
            name: 'Track daily spending',
            type: 'build',
            category: 'financial',
            frequency: 'daily',
            priority: 'high',
            reason: `Supports your goal: ${onboardingData.financialGoal}`
        });
    }
    
    return suggestions;
}

function showSuccessMessage() {
    const content = document.querySelector('.onboarding-content');
    content.innerHTML = `
        <div style="text-align: center; padding: 40px 0;">
            <div style="font-size: 5rem; margin-bottom: 20px;">🎉</div>
            <h2 style="font-size: 2rem; color: #2d3748; margin-bottom: 15px;">Profile Created!</h2>
            <p style="color: #718096; font-size: 1.1rem;">Your personalized HavHabit journey is ready...</p>
            <div style="margin-top: 30px;">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;
    
    // Add loading animation
    const style = document.createElement('style');
    style.textContent = `
        .loading-spinner {
            width: 40px;
            height: 40px;
            margin: 0 auto;
            border: 4px solid #e2e8f0;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }
    `;
    document.head.appendChild(style);
}
