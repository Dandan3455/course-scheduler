// 全局变量
let allSolutions = []; // Currently displayed solutions (filtered by pins)
let allOriginalSolutions = []; // All valid solutions (unfiltered)
let currentSolutionIndex = 0;
let coursesData = null;
let pinnedSections = {}; // { courseName: sectionId }
let selectedCoursesSet = new Set(); // Set of selected course names

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

// Merge separated LEC and LAB sections into complete sections
function mergeSections(sections) {
    const merged = {};
    
    for (const section of sections) {
        let baseId = section.id;
        
        // Only remove trailing 1 or 2 if the ID is 3+ characters (like "021", "022")
        // Don't modify 2-character IDs (like "01", "02")
        if (section.id.length >= 3 && /[12]$/.test(section.id)) {
            baseId = section.id.slice(0, -1);
        }
        
        if (!merged[baseId]) {
            merged[baseId] = {
                id: baseId,
                lec: [],
                lab: []
            };
        }
        
        // Merge lec and lab times
        merged[baseId].lec = [...merged[baseId].lec, ...section.lec];
        merged[baseId].lab = [...merged[baseId].lab, ...section.lab];
    }
    
    return Object.values(merged);
}

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

        // Auto-merge sections (combine LEC and LAB if separated)
        coursesData.courses = coursesData.courses.map(course => {
            return {
                name: course.name,
                sections: mergeSections(course.sections)
            };
        });

        // Clear pins when calculating new schedules
        pinnedSections = {};
        
        // Initialize selected courses (all selected by default)
        selectedCoursesSet = new Set(coursesData.courses.map(c => c.name));
        
        // Display course selector
        displayCourseSelector();
        
        // Generate schedules for selected courses
        recalculateSchedules();
        
        // Display results
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
        
        // Try all sections (no pin filtering here)
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
    
    // 显示课程表
    displayTimetable(schedule);

    // 更新按钮状态
    prevBtn.disabled = currentSolutionIndex === 0;
    nextBtn.disabled = currentSolutionIndex === allSolutions.length - 1;
}

// Display course selector with checkboxes
function displayCourseSelector() {
    const container = document.getElementById('courseCheckboxes');
    let html = '';
    
    coursesData.courses.forEach(course => {
        const isChecked = selectedCoursesSet.has(course.name);
        const checkedAttr = isChecked ? 'checked' : '';
        html += `
            <div class="course-checkbox-item">
                <label>
                    <input type="checkbox" ${checkedAttr} onchange="toggleCourseSelection('${course.name}')">
                    <span class="course-name">📖 ${course.name}</span>
                    <span class="section-count">(${course.sections.length} sections)</span>
                </label>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Toggle course selection
function toggleCourseSelection(courseName) {
    if (selectedCoursesSet.has(courseName)) {
        selectedCoursesSet.delete(courseName);
        // Also unpin if this course was pinned
        delete pinnedSections[courseName];
    } else {
        selectedCoursesSet.add(courseName);
    }
    
    recalculateSchedules();
}

// Recalculate schedules based on selected courses
function recalculateSchedules() {
    if (selectedCoursesSet.size === 0) {
        showError('Please select at least one course!');
        return;
    }
    
    // Filter courses to only include selected ones
    const selectedCourses = coursesData.courses.filter(c => selectedCoursesSet.has(c.name));
    
    // Generate all possible schedules for selected courses
    allOriginalSolutions = generateAllSchedules(selectedCourses);
    allSolutions = filterSolutionsByPins(allOriginalSolutions);
    
    if (allSolutions.length === 0) {
        showError('No valid schedules found! All combinations have time conflicts.');
        return;
    }
    
    // Display results
    hideError();
    currentSolutionIndex = 0;
    updateSolutionDisplay();
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
                const isPinned = pinnedSections[course.courseName] === course.sectionId;
                const pin = isPinned ? '<span class="pin-indicator">📍</span>' : '';
                const pinnedClass = isPinned ? ' pinned-cell' : '';
                html += `<td class="course-cell clickable-cell${pinnedClass}" onclick="togglePin('${course.courseName}', '${course.sectionId}')">${pin}<div>${course.courseName} (${course.type})<br>Section ${course.sectionId}</div></td>`;
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
    let minHour = 8;  // Default start
    let maxHour = 18; // Default end
    
    // Find actual time range from schedule
    schedule.forEach(item => {
        const allTimes = [...item.lec, ...item.lab];
        allTimes.forEach(time => {
            if (time.start < minHour) minHour = time.start;
            if (time.end > maxHour) maxHour = time.end;
        });
    });
    
    // Generate continuous time range
    const hours = [];
    for (let h = minHour; h < maxHour; h++) {
        hours.push(h);
    }
    
    return hours;
}

// 查找特定时间的课程
function findCourseAtTime(schedule, day, hour) {
    for (const item of schedule) {
        // Check lectures
        for (const time of item.lec) {
            if (time.day === day && hour >= time.start && hour < time.end) {
                return { ...item, type: 'LEC' };
            }
        }
        // Check labs
        for (const time of item.lab) {
            if (time.day === day && hour >= time.start && hour < time.end) {
                return { ...item, type: 'LAB' };
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

// Toggle pin status for a section
function togglePin(courseName, sectionId) {
    if (pinnedSections[courseName] === sectionId) {
        // Unpin
        delete pinnedSections[courseName];
    } else {
        // Pin
        pinnedSections[courseName] = sectionId;
    }
    
    // Filter original solutions based on pinned sections
    allSolutions = filterSolutionsByPins(allOriginalSolutions);
    
    if (allSolutions.length === 0) {
        showError('No valid schedules found with current pinned sections!');
        return;
    }
    
    // Reset to first solution
    hideError();
    currentSolutionIndex = 0;
    updateSolutionDisplay();
}

// Filter solutions to only include those matching all pinned sections
function filterSolutionsByPins(solutions) {
    if (Object.keys(pinnedSections).length === 0) {
        return solutions; // No pins, return all
    }
    
    return solutions.filter(schedule => {
        // Check if this schedule matches all pinned sections
        for (const courseName in pinnedSections) {
            const pinnedSectionId = pinnedSections[courseName];
            const courseInSchedule = schedule.find(item => item.courseName === courseName);
            
            if (!courseInSchedule || courseInSchedule.sectionId !== pinnedSectionId) {
                return false; // This schedule doesn't match the pin
            }
        }
        return true; // All pins match
    });
}
