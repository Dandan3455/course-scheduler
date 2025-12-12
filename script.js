// 全局变量
let allSolutions = [];
let currentSolutionIndex = 0;
let coursesData = null;

// 星期映射
const dayNames = {
    'mo': 'Monday',
    'tu': 'Tuesday',
    'we': 'Wednesday',
    'th': 'Thursday',
    'fr': 'Friday'
};

const dayOrder = ['mo', 'tu', 'we', 'th', 'fr'];

// DOM 元素
const showPromptBtn = document.getElementById('showPrompt');
const modal = document.getElementById('promptModal');
const closeModal = document.getElementsByClassName('close')[0];
const copyPromptBtn = document.getElementById('copyPrompt');
const calculateBtn = document.getElementById('calculateBtn');
const prevBtn = document.getElementById('prevSolution');
const nextBtn = document.getElementById('nextSolution');
const courseDataInput = document.getElementById('courseData');
const resultsSection = document.getElementById('results');
const errorDiv = document.getElementById('error');

// 事件监听
showPromptBtn.addEventListener('click', () => {
    modal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

copyPromptBtn.addEventListener('click', () => {
    const promptText = document.getElementById('promptText');
    promptText.select();
    document.execCommand('copy');
    copyPromptBtn.textContent = '✓ Copied';
    setTimeout(() => {
        copyPromptBtn.textContent = 'Copy Prompt';
    }, 2000);
});

calculateBtn.addEventListener('click', calculateSchedules);
prevBtn.addEventListener('click', () => changeSolution(-1));
nextBtn.addEventListener('click', () => changeSolution(1));

// 主要计算函数
function calculateSchedules() {
    try {
        // Parse input
        const input = courseDataInput.value.trim();
        if (!input) {
            showError('Please enter course data!');
            return;
        }

        coursesData = JSON.parse(input);
        
        if (!coursesData.courses || !Array.isArray(coursesData.courses)) {
            showError('Invalid data format: missing courses array');
            return;
        }

        // Generate all possible schedules
        allSolutions = generateAllSchedules(coursesData.courses);

        if (allSolutions.length === 0) {
            showError('No valid schedules found! All combinations have time conflicts.');
            return;
        }

        // Display results
        hideError();
        currentSolutionIndex = 0;
        updateSolutionDisplay();
        resultsSection.style.display = 'block';

    } catch (e) {
        showError('Data parsing error: ' + e.message);
    }
}

// 生成所有可能的选课组合
function generateAllSchedules(courses) {
    const validSchedules = [];
    
    // 生成所有可能的组合
    function generateCombinations(index, currentSchedule) {
        if (index === courses.length) {
            // 检查当前组合是否有时间冲突
            if (!hasConflict(currentSchedule)) {
                validSchedules.push([...currentSchedule]);
            }
            return;
        }

        const course = courses[index];
        for (const section of course.sections) {
            currentSchedule.push({
                courseName: course.name,
                sectionId: section.id,
                lec: section.lec,
                lab: section.lab
            });
            generateCombinations(index + 1, currentSchedule);
            currentSchedule.pop();
        }
    }

    generateCombinations(0, []);
    return validSchedules;
}

// 检查时间冲突
function hasConflict(schedule) {
    for (let i = 0; i < schedule.length; i++) {
        for (let j = i + 1; j < schedule.length; j++) {
            if (sectionsConflict(schedule[i], schedule[j])) {
                return true;
            }
        }
    }
    return false;
}

// 检查两个 section 是否冲突
function sectionsConflict(section1, section2) {
    const allTimes1 = [...section1.lec, ...section1.lab];
    const allTimes2 = [...section2.lec, ...section2.lab];

    for (const time1 of allTimes1) {
        for (const time2 of allTimes2) {
            if (timesOverlap(time1, time2)) {
                return true;
            }
        }
    }
    return false;
}

// 检查两个时间段是否重叠
function timesOverlap(time1, time2) {
    return time1.day === time2.day && 
           time1.start < time2.end && 
           time2.start < time1.end;
}

// 更新方案显示
function updateSolutionDisplay() {
    document.getElementById('currentSolution').textContent = currentSolutionIndex + 1;
    document.getElementById('totalSolutions').textContent = allSolutions.length;

    const schedule = allSolutions[currentSolutionIndex];
    
    // 显示选中的课程列表
    displaySelectedCourses(schedule);
    
    // 显示课程表
    displayTimetable(schedule);

    // 更新按钮状态
    prevBtn.disabled = currentSolutionIndex === 0;
    nextBtn.disabled = currentSolutionIndex === allSolutions.length - 1;
}

// Display selected courses
function displaySelectedCourses(schedule) {
    const container = document.getElementById('selectedCourses');
    let html = '<h3>Courses in this schedule:</h3>';
    
    schedule.forEach(item => {
        html += `<div class="course-item">📖 ${item.courseName} - Section ${item.sectionId}</div>`;
    });
    
    container.innerHTML = html;
}

// Display timetable
function displayTimetable(schedule) {
    const container = document.getElementById('timetable');
    
    // Get all time slots
    const timeSlots = getTimeSlots(schedule);
    
    // Create table
    let html = '<table><thead><tr><th>Time</th>';
    dayOrder.forEach(day => {
        html += `<th>${dayNames[day]}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Fill each time slot
    timeSlots.forEach(hour => {
        html += `<tr><td class="time-cell">${hour}:00</td>`;
        
        dayOrder.forEach(day => {
            const course = findCourseAtTime(schedule, day, hour);
            if (course) {
                html += `<td class="course-cell">${course.courseName}<br>Section ${course.sectionId}</td>`;
            } else {
                html += '<td></td>';
            }
        });
        
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// 获取所有涉及的时间段
function getTimeSlots(schedule) {
    const hours = new Set();
    
    schedule.forEach(item => {
        const allTimes = [...item.lec, ...item.lab];
        allTimes.forEach(time => {
            for (let h = time.start; h < time.end; h++) {
                hours.add(h);
            }
        });
    });

    return Array.from(hours).sort((a, b) => a - b);
}

// 查找特定时间的课程
function findCourseAtTime(schedule, day, hour) {
    for (const item of schedule) {
        const allTimes = [...item.lec, ...item.lab];
        for (const time of allTimes) {
            if (time.day === day && hour >= time.start && hour < time.end) {
                return item;
            }
        }
    }
    return null;
}

// 切换方案
function changeSolution(delta) {
    currentSolutionIndex += delta;
    if (currentSolutionIndex < 0) currentSolutionIndex = 0;
    if (currentSolutionIndex >= allSolutions.length) {
        currentSolutionIndex = allSolutions.length - 1;
    }
    updateSolutionDisplay();
}

// 错误处理
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    resultsSection.style.display = 'none';
}

function hideError() {
    errorDiv.style.display = 'none';
}
