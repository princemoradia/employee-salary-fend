import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const App = () => {
  const regularDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDate = new Date(); // 12:36 PM IST, August 02, 2025 (UTC+5:30)
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [visibleMonth, setVisibleMonth] = useState(null);
  const [visibleDepartment, setVisibleDepartment] = useState(null);
  const [editStates, setEditStates] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDeptEmployee, setSelectedDeptEmployee] = useState(null);
  const [modalMessage, setModalMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isInitialFetchDone, setIsInitialFetchDone] = useState(false);
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedPaidSubTab, setSelectedPaidSubTab] = useState('cash');

  const months = useMemo(() => {
    if (employees.length === 0) return [];
    const startDates = employees.map(emp => new Date(emp.startDate));
    const earliestStart = new Date(Math.min(...startDates));
    const months = [];
    let current = new Date(earliestStart.getFullYear(), earliestStart.getMonth(), 1);
    while (current <= currentDate) {
      months.push(`${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }
    return months.sort((a, b) => new Date(b) - new Date(a));
  }, [employees]);

  const fetchData = async () => {
    try {
      const [deptRes, empRes, holidayRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/api/departments`),
        axios.get(`${process.env.REACT_APP_API_URL}/api/employees`),
        axios.get(`${process.env.REACT_APP_API_URL}/api/holidays`),
      ]);
      setDepartments(deptRes.data);
      setEmployees(empRes.data);
      setHolidays(holidayRes.data.map(h => h.date));
      setIsInitialFetchDone(true);
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Error fetching data from server');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isInitialFetchDone) {
      scheduleDefaultEntries();
    }
  }, [isInitialFetchDone, employees, holidays]);

  const showModalMessage = (message) => {
    setModalMessage(message);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const getDepartmentHours = (deptName, date) => {
    const dept = departments.find(d => d.name === deptName);
    if (!dept) return 12;
    const sortedHistory = dept.hoursHistory.sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));
    const historyEntry = sortedHistory.find(h => new Date(h.effectiveDate) <= new Date(date));
    return historyEntry ? historyEntry.hours : dept.hours;
  };

  const getSalaryForDate = (employee, date) => {
    const sortedHistory = employee.salaryHistory.sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));
    return sortedHistory.find(h => new Date(h.effectiveDate) <= new Date(date))?.salary || employee.baseSalary;
  };

  const updateDepartmentSummary = () => {
    return (
      <div className="department-summary" id="departmentSummary">
        <h5 className="mb-2">Department Working Hours History</h5>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Current Hours/Day</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => (
              <tr key={dept.name}>
                <td>{dept.name}</td>
                <td>{dept.hours}</td>
                <td>{dept.hoursHistory.map(h => `${h.hours} hrs (from ${h.effectiveDate})`).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const addEmployee = async () => {
    const name = document.getElementById('newEmpName').value.trim();
    const baseSalary = parseFloat(document.getElementById('newEmpSalary').value);
    const startDate = document.getElementById('startDate').value;
    const department = document.getElementById('department').value;

    if (!name) return showModalMessage('Employee name cannot be empty.');
    if (name.length > 50) return showModalMessage('Employee name must be 50 characters or less.');
    if (employees.some(emp => emp.name.toLowerCase() === name.toLowerCase())) return showModalMessage('Employee name must be unique.');
    if (!baseSalary || baseSalary < 1000) return showModalMessage('Salary must be at least ₹1000.');
    if (!startDate) return showModalMessage('Start date is required.');
    if (new Date(startDate) > currentDate) return showModalMessage('Start date cannot be in the future.');
    if (!department) return showModalMessage('Please select a department.');

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/employees`, { name, baseSalary, startDate, department });
      setEmployees([...employees, res.data]);
      document.getElementById('newEmpName').value = '';
      document.getElementById('newEmpSalary').value = '';
      document.getElementById('startDate').value = '';
      document.getElementById('department').value = departments[0]?.name || '';
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to add employee');
    }
  };

  const transferDepartment = async () => {
    const empName = document.getElementById('transferEmpSelect').value;
    const newDept = document.getElementById('newDepartment').value;

    if (!empName) return showModalMessage('Please select an employee.');
    if (!newDept) return showModalMessage('Please select a new department.');
    if (employees.find(emp => emp.name === empName)?.department === newDept) return showModalMessage('Employee is already in this department.');

    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/api/employees/${empName}/department`, { department: newDept });
      setEmployees(employees.map(emp => emp.name === empName ? res.data : emp));
      setSelectedDeptEmployee(null);
      document.getElementById('transferEmpSelect').value = '';
      document.getElementById('newDepartment').value = departments[0]?.name || '';
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to transfer department');
    }
  };

  const markInactive = async () => {
    const empName = document.getElementById('inactiveEmpSelect').value;
    const endDate = document.getElementById('inactiveDate').value;

    if (!empName) return showModalMessage('Please select an employee.');
    if (!endDate) return showModalMessage('Please select an end date.');
    if (new Date(endDate) < new Date(employees.find(emp => emp.name === empName)?.startDate)) return showModalMessage('End date must be after start date.');
    if (new Date(endDate) > currentDate) return showModalMessage('End date cannot be in the future.');

    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/api/employees/${empName}/inactive`, { endDate });
      setEmployees(employees.map(emp => emp.name === empName ? res.data : emp));
      setSelectedEmployee(empName === selectedEmployee ? null : selectedEmployee);
      setSelectedDeptEmployee(empName === selectedDeptEmployee ? null : selectedDeptEmployee);
      document.getElementById('inactiveEmpSelect').value = '';
      document.getElementById('inactiveDate').value = '';
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to mark employee inactive');
    }
  };

  const updateSalary = async () => {
    const empName = document.getElementById('updateEmpSelect').value;
    const newSalary = parseFloat(document.getElementById('newSalary').value);
    const effectiveDate = document.getElementById('salaryEffectiveDate').value || currentDate.toISOString().split('T')[0];

    if (!empName) return showModalMessage('Please select an employee.');
    if (!newSalary || newSalary < 1000) return showModalMessage('New salary must be at least ₹1000.');
    if (employees.find(emp => emp.name === empName)?.baseSalary === newSalary) return showModalMessage('New salary must be different from current salary.');
    if (!effectiveDate) return showModalMessage('Please select an effective date.');
    if (new Date(effectiveDate) > currentDate) return showModalMessage('Effective date cannot be in the future.');

    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/api/employees/${empName}/salary`, { salary: newSalary, effectiveDate });
      setEmployees(employees.map(emp => emp.name === empName ? res.data : emp));
      document.getElementById('updateEmpSelect').value = '';
      document.getElementById('newSalary').value = '';
      document.getElementById('salaryEffectiveDate').value = '';
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to update salary');
    }
  };

  const addDepartment = async () => {
    const deptName = document.getElementById('newDeptName').value.trim();
    const deptHours = parseFloat(document.getElementById('newDeptHours').value);

    if (!deptName) return showModalMessage('Department name cannot be empty.');
    if (deptName.length > 50) return showModalMessage('Department name must be 50 characters or less.');
    if (departments.some(dept => dept.name === deptName)) return showModalMessage('Department already exists.');
    if (!deptHours || deptHours < 1 || deptHours > 24) return showModalMessage('Daily hours must be between 1 and 24.');

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/departments`, { name: deptName, hours: deptHours });
      setDepartments([...departments, res.data]);
      document.getElementById('newDeptName').value = '';
      document.getElementById('newDeptHours').value = '';
      document.getElementById('department').value = res.data.name;
      document.getElementById('newDepartment').value = res.data.name;
      document.getElementById('updateDeptSelect').value = res.data.name;
      document.getElementById('deleteDeptSelect').value = res.data.name;
      document.getElementById('massDeptSelect').value = res.data.name;
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to add department');
    }
  };

  const deleteDepartment = async () => {
    const deptName = document.getElementById('deleteDeptSelect').value;

    if (!deptName) return showModalMessage('Please select a department to delete.');
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/departments/${deptName}`);
      setDepartments(departments.filter(dept => dept.name !== deptName));
      document.getElementById('deleteDeptSelect').value = departments[0]?.name || '';
      document.getElementById('department').value = departments[0]?.name || '';
      document.getElementById('newDepartment').value = departments[0]?.name || '';
      document.getElementById('updateDeptSelect').value = departments[0]?.name || '';
      document.getElementById('massDeptSelect').value = departments[0]?.name || '';
      setSelectedDeptEmployee(null);
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to delete department');
    }
  };

  const updateDepartmentHours = async () => {
    const deptName = document.getElementById('updateDeptSelect').value;
    const hoursInput = document.getElementById('updateDeptHours').value.trim();
    const newHours = parseFloat(hoursInput);
    const effectiveDate = document.getElementById('updateDeptDate').value || currentDate.toISOString().split('T')[0];

    if (!deptName) return showModalMessage('Please select a department.');
    if (!hoursInput || isNaN(newHours) || newHours < 1 || newHours > 24) return showModalMessage('Daily hours must be between 1 and 24.');
    if (!effectiveDate) return showModalMessage('Please select an effective date.');
    if (new Date(effectiveDate) > currentDate) return showModalMessage('Effective date cannot be in the future.');
    if (departments.find(d => d.name === deptName)?.hours === newHours) return showModalMessage('New hours must be different from current hours.');

    try {
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/api/departments/${deptName}/hours`, { hours: newHours, effectiveDate });
      setDepartments(departments.map(dept => dept.name === deptName ? res.data : dept));
      document.getElementById('updateDeptHours').value = '';
      document.getElementById('updateDeptSelect').value = departments[0]?.name || '';
      document.getElementById('updateDeptDate').value = '';
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to update department hours');
    }
  };

  const addHoliday = async () => {
    const holidayDate = document.getElementById('holidayDate').value;

    if (!holidayDate) return showModalMessage('Please select a holiday date.');
    if (new Date(holidayDate) > currentDate) return showModalMessage('Holiday date cannot be in the future.');
    if (holidays.includes(holidayDate)) return showModalMessage('Holiday date already exists.');

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/holidays`, { date: holidayDate });
      setHolidays([...holidays, res.data.date]);
      document.getElementById('holidayDate').value = '';
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to add holiday');
    }
  };

  const addMassEntry = async () => {
    const deptName = document.getElementById('massDeptSelect').value;
    const massDate = document.getElementById('massEntryDate').value;
    const massHours = parseFloat(document.getElementById('massEntryHours').value);

    if (!deptName) return showModalMessage('Please select a department.');
    if (!massDate) return showModalMessage('Please select a date.');
    if (new Date(massDate) > currentDate) return showModalMessage('Date cannot be in the future.');
    if (holidays.includes(massDate)) return showModalMessage('Cannot set hours for a holiday.');
    if (isNaN(massHours) || massHours < 0 || massHours > 24) return showModalMessage('Hours must be between 0 and 24.');

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/entries/mass`, {
        department: deptName,
        date: massDate,
        hours: massHours,
      });
      setEmployees(employees.map(emp => {
        const updatedEmp = res.data.find(e => e.name === emp.name);
        return updatedEmp || emp;
      }));
      document.getElementById('massDeptSelect').value = departments[0]?.name || '';
      document.getElementById('massEntryDate').value = '';
      document.getElementById('massEntryHours').value = '';
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to add mass entry');
    }
  };

  const scheduleDefaultEntries = async () => {
    for (const emp of employees) {
      const startDate = new Date(emp.startDate);
      const endDate = emp.endDate ? new Date(emp.endDate) : currentDate;
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

      while (current <= endDate && current <= currentDate) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const lastDayToCalculate = (current.getFullYear() === currentDate.getFullYear() && current.getMonth() === currentDate.getMonth()) ? currentDate.getDate() : daysInMonth;

        for (let i = 1; i <= lastDayToCalculate; i++) {
          const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
          if (holidays.includes(dateStr)) continue;
          const date = new Date(dateStr);
          const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' });
          if (!regularDays.includes(dayOfWeek) || date < startDate || emp.entries.some(entry => entry.date === dateStr)) continue;

          try {
            await axios.post(`${process.env.REACT_APP_API_URL}/api/entries`, {
              empName: emp.name,
              date: dateStr,
              workType: 'FULL_DAY',
              startTime: '',
              endTime: '',
              hours: 0,
            });
          } catch (error) {
            console.error('Error scheduling default entry:', error);
          }
        }
        current.setMonth(current.getMonth() + 1);
      }
    }
    await fetchData();
  };

  const updateEntry = async (empName, date, workType, startTime, endTime, hours) => {
    if (holidays.includes(date)) return showModalMessage('Cannot update entries for holidays.');
    if (new Date(date) > currentDate) return showModalMessage('Cannot update entries for future dates.');
    if (workType === 'CUSTOM' && (!startTime || !endTime)) return showModalMessage('Start and end times are required for CUSTOM work type.');
    if (workType === 'CUSTOM_HOURS' && (hours === undefined || hours < 0 || hours > 24)) return showModalMessage('Hours must be between 0 and 24 for CUSTOM_HOURS work type.');

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/entries`, { 
        empName, 
        date, 
        workType, 
        startTime, 
        endTime, 
        hours: workType === 'CUSTOM_HOURS' ? parseFloat(hours) : 0 
      });
      setEmployees(employees.map(emp => emp.name === empName ? res.data : emp));
      await fetchData();
    } catch (error) {
      showModalMessage(error.response?.data?.error || 'Failed to update attendance entry');
    }
  };

  const showMonth = (month) => {
    setVisibleMonth(month);
    setVisibleDepartment(null);
  };

  const showDepartment = (month, dept) => {
    setVisibleMonth(month);
    setVisibleDepartment(dept);
  };

  const startEditTable = (month, dept) => {
    const key = `table-${month}-${dept}`;
    const newEditStates = { ...editStates, [key]: {} };
    const table = document.getElementById(`table-${month}-${dept}`);
    if (!table) return;

    table.querySelectorAll(`td:not(.holiday):not(:first-child)`).forEach(td => {
      const select = td.querySelector('.work-type');
      if (!select) return;

      const columnIndex = Array.from(td.parentElement.children).indexOf(td) + 1;
      const headerRow = td.parentElement.parentElement.parentElement.querySelector('thead tr');
      const th = headerRow ? headerRow.querySelector(`th:nth-child(${columnIndex})`) : null;
      const empName = th ? th.textContent : null;
      if (!empName) return;

      const dateStr = td.parentElement.cells[0].textContent.split(' ')[0];
      const date = `${month}-${dateStr.padStart(2, '0')}`;
      const startTime = td.querySelector('.start-time');
      const endTime = td.querySelector('.end-time');
      const hoursInput = td.querySelector('.hours-input');

      newEditStates[key][`${empName}-${date}`] = {
        workType: select.value,
        startTime: startTime ? startTime.value : '',
        endTime: endTime ? endTime.value : '',
        hours: hoursInput ? hoursInput.value : '',
        isStartTimeVisible: select.value === 'CUSTOM',
        isEndTimeVisible: select.value === 'CUSTOM',
        isHoursVisible: select.value === 'CUSTOM_HOURS',
      };

      select.disabled = false;
      if (startTime && endTime) {
        if (select.value === 'CUSTOM') {
          startTime.classList.remove('hidden');
          endTime.classList.remove('hidden');
          startTime.disabled = false;
          endTime.disabled = false;
        } else {
          startTime.classList.add('hidden');
          endTime.classList.add('hidden');
          startTime.disabled = true;
          endTime.disabled = true;
        }
      }
      if (hoursInput) {
        if (select.value === 'CUSTOM_HOURS') {
          hoursInput.classList.remove('hidden');
          hoursInput.disabled = false;
        } else {
          hoursInput.classList.add('hidden');
          hoursInput.disabled = true;
        }
      }
    });

    setEditStates(newEditStates);
    table.querySelector('.edit-button').classList.add('hidden');
    table.querySelector('.save-button').classList.remove('hidden');
    table.querySelector('.cancel-button').classList.remove('hidden');
  };

  const saveEditTable = async (month, dept) => {
    const table = document.getElementById(`table-${month}-${dept}`);
    if (!table) return showModalMessage('Table not found for saving edits.');

    const key = `table-${month}-${dept}`;
    const state = editStates[key];

    for (const td of table.querySelectorAll('td:not(.holiday):not(:first-child)')) {
      const select = td.querySelector('.work-type');
      if (!select) continue;

      const columnIndex = Array.from(td.parentElement.children).indexOf(td) + 1;
      const headerRow = table.querySelector('thead tr');
      const th = headerRow ? headerRow.querySelector(`th:nth-child(${columnIndex})`) : null;
      const empName = th ? th.textContent : null;
      if (!empName) continue;

      const dateStr = td.parentElement.cells[0].textContent.split(' ')[0];
      const date = `${month}-${dateStr.padStart(2, '0')}`;
      const cellKey = `${empName}-${date}`;
      const cellState = state?.[cellKey];

      if (!cellState) continue;

      const startTimeValue = cellState.workType === 'CUSTOM' ? cellState.startTime : '';
      const endTimeValue = cellState.workType === 'CUSTOM' ? cellState.endTime : '';
      const hoursValue = cellState.workType === 'CUSTOM_HOURS' ? parseFloat(cellState.hours) || 0 : 0;

      await updateEntry(empName, date, cellState.workType, startTimeValue, endTimeValue, hoursValue);

      select.disabled = true;
      const startTime = td.querySelector('.start-time');
      const endTime = td.querySelector('.end-time');
      const hoursInput = td.querySelector('.hours-input');
      if (startTime) {
        startTime.disabled = true;
        if (cellState.workType !== 'CUSTOM') startTime.classList.add('hidden');
      }
      if (endTime) {
        endTime.disabled = true;
        if (cellState.workType !== 'CUSTOM') endTime.classList.add('hidden');
      }
      if (hoursInput) {
        hoursInput.disabled = true;
        if (cellState.workType !== 'CUSTOM_HOURS') hoursInput.classList.add('hidden');
      }
    }

    table.querySelector('.edit-button').classList.remove('hidden');
    table.querySelector('.save-button').classList.add('hidden');
    table.querySelector('.cancel-button').classList.add('hidden');
    setEditStates({ ...editStates, [key]: undefined });
  };

  const cancelEditTable = (month, dept) => {
    const table = document.getElementById(`table-${month}-${dept}`);
    const key = `table-${month}-${dept}`;
    const state = editStates[key];

    if (state) {
      table.querySelectorAll('td:not(.holiday):not(:first-child)').forEach(td => {
        const select = td.querySelector('.work-type');
        if (!select) return;

        const columnIndex = Array.from(td.parentElement.children).indexOf(td) + 1;
        const headerRow = td.parentElement.parentElement.parentElement.querySelector('thead tr');
        const th = headerRow ? headerRow.querySelector(`th:nth-child(${columnIndex})`) : null;
        const empName = th ? th.textContent : null;
        if (!empName) return;

        const dateStr = td.parentElement.cells[0].textContent.split(' ')[0];
        const date = `${month}-${dateStr.padStart(2, '0')}`;
        const cellState = state[`${empName}-${date}`];

        if (cellState) {
          select.value = cellState.workType;
          const startTime = td.querySelector('.start-time');
          const endTime = td.querySelector('.end-time');
          const hoursInput = td.querySelector('.hours-input');
          if (startTime) startTime.value = cellState.startTime;
          if (endTime) endTime.value = cellState.endTime;
          if (hoursInput) hoursInput.value = cellState.hours;
          select.disabled = true;
          if (startTime) startTime.disabled = true;
          if (endTime) endTime.disabled = true;
          if (hoursInput) hoursInput.disabled = true;

          if (cellState.workType === 'CUSTOM') {
            startTime.classList.remove('hidden');
            endTime.classList.remove('hidden');
          } else {
            startTime.classList.add('hidden');
            endTime.classList.add('hidden');
          }
          if (cellState.workType === 'CUSTOM_HOURS') {
            hoursInput.classList.remove('hidden');
          } else {
            hoursInput.classList.add('hidden');
          }
        }
      });

      table.querySelector('.edit-button').classList.remove('hidden');
      table.querySelector('.save-button').classList.add('hidden');
      table.querySelector('.cancel-button').classList.add('hidden');
      setEditStates({ ...editStates, [key]: undefined });
    }
  };

  const updateTimeInputConstraints = (startTimeInput, endTimeInput) => {
    if (startTimeInput.value) {
      const [hours, minutes] = startTimeInput.value.split(':').map(Number);
      const minEndTime = new Date(0, 0, 0, hours, minutes + 1);
      endTimeInput.min = `${minEndTime.getHours().toString().padStart(2, '0')}:${minEndTime.getMinutes().toString().padStart(2, '0')}`;
    } else {
      endTimeInput.min = '';
    }
  };

  const workTypeEffectRan = useRef(false);
  useEffect(() => {
    if (workTypeEffectRan.current) return;

    const handleWorkTypeChange = (event) => {
      const select = event.target;
      if (!select.classList.contains('work-type')) return;
      const td = select.parentElement;
      const startTime = td.querySelector('.start-time');
      const endTime = td.querySelector('.end-time');
      const hoursInput = td.querySelector('.hours-input');

      if (select.value === 'CUSTOM') {
        if (startTime && endTime) {
          startTime.classList.remove('hidden');
          endTime.classList.remove('hidden');
          startTime.disabled = false;
          endTime.disabled = false;
          updateTimeInputConstraints(startTime, endTime);
        }
        if (hoursInput) {
          hoursInput.classList.add('hidden');
          hoursInput.disabled = true;
          hoursInput.value = '';
        }
      } else if (select.value === 'CUSTOM_HOURS') {
        if (hoursInput) {
          hoursInput.className = 'hours-input form-control';
          hoursInput.disabled = false;
        }
        if (startTime && endTime) {
          startTime.className = 'time-input start-time form-control hidden';
          endTime.className = 'time-input end-time form-control hidden';
          startTime.disabled = true;
          endTime.disabled = true;
          startTime.value = '';
          endTime.value = '';
        }
      } else {
        if (startTime && endTime) {
          startTime.className = 'time-input start-time form-control hidden';
          endTime.className = 'time-input end-time form-control hidden';
          startTime.disabled = true;
          endTime.disabled = true;
          startTime.value = '';
          endTime.value = '';
        }
        if (hoursInput) {
          hoursInput.className = 'hours-input form-control hidden';
          hoursInput.disabled = true;
          hoursInput.value = '';
        }
      }
    };

    const handleStartTimeChange = (event) => {
      const startTime = event.target;
      if (!startTime.classList.contains('start-time')) return;
      const endTime = startTime.parentElement.querySelector('.end-time');
      if (endTime) updateTimeInputConstraints(startTime, endTime);
    };

    document.addEventListener('change', handleWorkTypeChange);
    document.addEventListener('change', handleStartTimeChange);

    workTypeEffectRan.current = true;
    return () => {
      document.removeEventListener('change', handleWorkTypeChange);
      document.removeEventListener('change', handleStartTimeChange);
    };
  }, []);

  const generateMonthTables = () => {
    if (!isInitialFetchDone || employees.every(emp => !emp.entries || emp.entries.length === 0)) {
      return <div>Loading attendance data...</div>;
    }

    return (
      <>
        <div id="monthButtons" className="mb-4">
          {months.map(month => (
            <div 
              key={month} 
              className={`month-button ${visibleMonth === month ? 'active' : ''}`} 
              onClick={() => showMonth(month)}
            >
              {new Date(`${month}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          ))}
        </div>
        <div id="monthTables">
          {months.map(month => {
            const monthDate = new Date(`${month}-01`);
            const monthStart = new Date(`${month}-01`);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

            const departmentsWithEmployees = [...new Set(employees
              .filter(emp => {
                const start = new Date(emp.startDate);
                const end = emp.endDate ? new Date(emp.endDate) : new Date('9999-12-31');
                return start <= monthEnd && end >= monthStart;
              })
              .map(emp => emp.department)
            )];

            return (
              <div key={month} id={`deptButtons-${month}`} className="department-section" style={{ display: visibleMonth === month ? 'block' : 'none' }}>
                {(month === months[0] || departmentsWithEmployees.length > 0) && departmentsWithEmployees.map(dept => (
                  <button 
                    key={dept} 
                    className={`dept-button ${visibleDepartment === dept && visibleMonth === month ? 'active' : ''}`} 
                    onClick={() => showDepartment(month, dept)}
                  >
                    {dept}
                  </button>
                ))}
                {departmentsWithEmployees.map(department => {
                  const activeEmployees = employees.filter(emp => {
                    const start = new Date(emp.startDate);
                    const end = emp.endDate ? new Date(emp.endDate) : new Date('9999-12-31');
                    return emp.department === department && start <= monthEnd && end >= monthStart;
                  });

                  if (activeEmployees.length === 0 && month !== months[0]) return null;

                  const key = `table-${month}-${department}`;
                  const isEditing = !!editStates[key];

                  return (
                    <div key={department} className="department-section">
                      <div id={`table-${month}-${department}`} className={`month-table month-table-${month} ${visibleMonth === month && visibleDepartment === department ? 'active' : ''}`}>
                        <h4 className="h5 fw-semibold mb-3">{department}</h4>
                        <div className="mb-3">
                          <button className="edit-button action-button" onClick={() => startEditTable(month, department)}>Edit Table</button>
                          <button className="save-button btn btn-success hidden" onClick={() => saveEditTable(month, department)}>Save</button>
                          <button className="cancel-button btn btn-danger hidden" onClick={() => cancelEditTable(month, department)}>Cancel</button>
                        </div>
                        <div className="scroll-table-x">
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                {activeEmployees.map(emp => <th key={emp.name}>{emp.name}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate() }, (_, i) => {
                                const dateStr = `${month}-${(i + 1).toString().padStart(2, '0')}`;
                                const date = new Date(dateStr);
                                const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
                                const isHoliday = holidays.includes(dateStr);

                                return (
                                  <tr key={dateStr}>
                                    <td>{i + 1} {dayOfWeek}</td>
                                    {activeEmployees.map(emp => {
                                      const entry = (emp.entries || []).find(e => e.date === dateStr);
                                      const isActive = new Date(emp.startDate) <= date && (!emp.endDate || new Date(emp.endDate) >= date);
                                      const workType = entry ? entry.workType : (isActive && regularDays.includes(dayOfWeek) && date <= currentDate ? 'FULL_DAY' : '');

                                      const cellKey = `${emp.name}-${dateStr}`;
                                      const cellState = isEditing ? editStates[key]?.[cellKey] : null;
                                      const showTimeInputs = cellState ? cellState.workType === 'CUSTOM' : workType === 'CUSTOM';
                                      const showHoursInput = cellState ? cellState.workType === 'CUSTOM_HOURS' : workType === 'CUSTOM_HOURS';

                                      if (isHoliday) return <td key={emp.name} className="holiday">Holiday</td>;
                                      if (!isActive) return <td key={emp.name}>-</td>;

                                      if (workType.includes('-') && !isEditing) {
                                        const [startTime, endTime] = workType.split('-');
                                        return (
                                          <td key={emp.name}>
                                            <select className="work-type form-select" value="CUSTOM" disabled>
                                              <option value=""></option>
                                              <option value="FULL_DAY">FULL DAY</option>
                                              <option value="HALF_DAY">HALF DAY</option>
                                              <option value="CUSTOM">CUSTOM</option>
                                              <option value="CUSTOM_HOURS">CUSTOM HOURS</option>
                                              <option value="LEAVE">LEAVE</option>
                                            </select>
                                            <input type="time" className="time-input start-time form-control" value={startTime} disabled />
                                            <input type="time" className="time-input end-time form-control" value={endTime} disabled />
                                            <input type="number" className="hours-input form-control hidden" value="" disabled />
                                          </td>
                                        );
                                      }

                                      if (workType.startsWith('HOURS_') && !isEditing) {
                                        const hours = workType.replace('HOURS_', '');
                                        return (
                                          <td key={emp.name}>
                                            <select className="work-type form-select" value="CUSTOM_HOURS" disabled>
                                              <option value=""></option>
                                              <option value="FULL_DAY">FULL DAY</option>
                                              <option value="HALF_DAY">HALF DAY</option>
                                              <option value="CUSTOM">CUSTOM</option>
                                              <option value="CUSTOM_HOURS">CUSTOM HOURS</option>
                                              <option value="LEAVE">LEAVE</option>
                                            </select>
                                            <input type="time" className="time-input start-time form-control hidden" value="" disabled />
                                            <input type="time" className="time-input end-time form-control hidden" value="" disabled />
                                            <input type="number" className="hours-input form-control" value={hours} disabled min="0" max="24" step="0.5" />
                                          </td>
                                        );
                                      }

                                      if (workType === 'LEAVE' && !isEditing) {
                                        return (
                                          <td key={emp.name}>
                                            <select className="work-type form-select" value="LEAVE" disabled>
                                              <option value=""></option>
                                              <option value="FULL_DAY">FULL DAY</option>
                                              <option value="HALF_DAY">HALF DAY</option>
                                              <option value="CUSTOM">CUSTOM</option>
                                              <option value="CUSTOM_HOURS">CUSTOM HOURS</option>
                                              <option value="LEAVE">LEAVE</option>
                                            </select>
                                            <input type="time" className="time-input start-time form-control hidden" value="" disabled />
                                            <input type="time" className="time-input end-time form-control hidden" value="" disabled />
                                            <input type="number" className="hours-input form-control hidden" value="" disabled />
                                          </td>
                                        );
                                      }

                                      return (
                                        <td key={emp.name}>
                                          <select
                                            className="work-type form-select"
                                            value={cellState ? cellState.workType : workType}
                                            disabled={!isEditing}
                                            onChange={isEditing ? (e) => {
                                              const newType = e.target.value;
                                              setEditStates(prev => ({
                                                ...prev,
                                                [key]: {
                                                  ...prev[key],
                                                  [cellKey]: {
                                                    ...prev[key]?.[cellKey],
                                                    workType: newType,
                                                    startTime: newType === 'CUSTOM' ? prev[key]?.[cellKey]?.startTime || '' : '',
                                                    endTime: newType === 'CUSTOM' ? prev[key]?.[cellKey]?.endTime || '' : '',
                                                    hours: newType === 'CUSTOM_HOURS' ? prev[key]?.[cellKey]?.hours || '' : '',
                                                    isStartTimeVisible: newType === 'CUSTOM',
                                                    isEndTimeVisible: newType === 'CUSTOM',
                                                    isHoursVisible: newType === 'CUSTOM_HOURS',
                                                  }
                                                }
                                              }));
                                            } : undefined}
                                          >
                                            <option value=""></option>
                                            <option value="FULL_DAY">FULL DAY</option>
                                            <option value="HALF_DAY">HALF DAY</option>
                                            <option value="CUSTOM">CUSTOM</option>
                                            <option value="CUSTOM_HOURS">CUSTOM HOURS</option>
                                            <option value="LEAVE">LEAVE</option>
                                          </select>
                                          <input
                                            type="time"
                                            className={`time-input start-time form-control${showTimeInputs ? '' : ' hidden'}`}
                                            value={cellState ? cellState.startTime : (workType === 'CUSTOM' && entry?.startTime ? entry.startTime : '')}
                                            disabled={!isEditing || !showTimeInputs}
                                            onChange={isEditing && showTimeInputs ? (e) => {
                                              setEditStates(prev => ({
                                                ...prev,
                                                [key]: {
                                                  ...prev[key],
                                                  [cellKey]: {
                                                    ...prev[key][cellKey],
                                                    startTime: e.target.value,
                                                  }
                                                }
                                              }));
                                            } : undefined}
                                          />
                                          <input
                                            type="time"
                                            className={`time-input end-time form-control${showTimeInputs ? '' : ' hidden'}`}
                                            value={cellState ? cellState.endTime : (workType === 'CUSTOM' && entry?.endTime ? entry.endTime : '')}
                                            disabled={!isEditing || !showTimeInputs}
                                            onChange={isEditing && showTimeInputs ? (e) => {
                                              setEditStates(prev => ({
                                                ...prev,
                                                [key]: {
                                                  ...prev[key],
                                                  [cellKey]: {
                                                    ...prev[key][cellKey],
                                                    endTime: e.target.value,
                                                  }
                                                }
                                              }));
                                            } : undefined}
                                          />
                                          <input
                                            type="number"
                                            className={`hours-input form-control${showHoursInput ? '' : ' hidden'}`}
                                            value={cellState ? cellState.hours : (workType.startsWith('HOURS_') ? workType.replace('HOURS_', '') : '')}
                                            disabled={!isEditing || !showHoursInput}
                                            min="0"
                                            max="24"
                                            step="0.5"
                                            onChange={isEditing && showHoursInput ? (e) => {
                                              setEditStates(prev => ({
                                                ...prev,
                                                [key]: {
                                                  ...prev[key],
                                                  [cellKey]: {
                                                    ...prev[key][cellKey],
                                                    hours: e.target.value,
                                                  }
                                                }
                                              }));
                                            } : undefined}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const showEmployeeDetails = (empName) => {
    setSelectedEmployee(empName);
  };

  const showDeptEmployeeDetails = (empName) => {
    setSelectedDeptEmployee(empName);
  };

  const showSalaryMonth = (month) => {
    setSelectedSalaryMonth(month);
    setSelectedTab('all');
    setSelectedPaidSubTab('cash');
  };
const startEditSalary = (month) => {
    const key = `salary-${month}`;
    const newEditStates = { ...editStates, [key]: {} };
    const monthDate = new Date(`${month}-01`);
    const monthStart = new Date(`${month}-01`);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const activeEmployees = employees.filter(emp => {
        const start = new Date(emp.startDate);
        const end = emp.endDate ? new Date(emp.endDate) : new Date('9999-12-31');
        return start <= monthEnd && end >= monthStart;
    });
    console.log(`Starting edit for month ${month}. Active employees:`, activeEmployees.map(emp => emp.name));
    activeEmployees.forEach(emp => {
        const ps = (emp.paymentStatus || []).find(p => p.month === month) || { status: 'unpaid', method: '' };
        newEditStates[key][emp.name] = { status: ps.status, method: ps.method || '' };
    });
    setEditStates(newEditStates);
};

const saveEditSalary = async (month) => {
    const key = `salary-${month}`;
    const state = editStates[key];
    if (!state) {
        showModalMessage('No changes to save for this month.');
        return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
        showModalMessage('Invalid month format. Expected YYYY-MM.');
        return;
    }
    for (const empName of Object.keys(state)) {
        const employee = employees.find(emp => emp.name === empName);
        if (!employee) {
            console.warn(`Employee "${empName}" not found in employees list. Skipping update.`);
            showModalMessage(`Employee "${empName}" not found. Please refresh the page and try again.`);
            continue;
        }
        const { status, method } = state[empName];
        if (status === 'paid' && !['bank', 'cash', 'all'].includes(method)) {
            showModalMessage(`Invalid payment method for ${empName}. Please select a valid payment method.`);
            continue;
        }
        try {
            const encodedEmpName = encodeURIComponent(empName);
            const payload = { status };
            if (status === 'paid') payload.method = method;
            console.log(`Sending PUT request for ${empName}, month: ${month}, payload:`, payload);
            const res = await axios.put(`${process.env.REACT_APP_API_URL}/api/employees/${encodedEmpName}/payment/${month}`, payload);
            setEmployees(employees.map(e => e.name === empName ? res.data : e));
        } catch (error) {
            console.error(`Error updating payment status for ${empName}:`, {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            showModalMessage(`Failed to update payment status for ${empName}: ${error.response?.data?.error || error.message}`);
        }
    }
    setEditStates({ ...editStates, [key]: undefined });
};

  const cancelEditSalary = (month) => {
    setEditStates({ ...editStates, [`salary-${month}`]: undefined });
  };

  const renderEmployeeDetails = () => {
    const employee = employees.find(emp => emp.name === selectedEmployee);
    if (!employee) return null;

    return (
      <div>
        <h3 className="h5 fw-semibold mb-4">{employee.name}'s Monthly Salary Details</h3>
        {months.map(month => {
          const monthDate = new Date(`${month}-01`);
          const monthName = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          const startDate = new Date(employee.startDate);
          const endDate = employee.endDate ? new Date(employee.endDate) : new Date('9999-12-31');
          const monthStart = new Date(`${month}-01`);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

          if (startDate > monthEnd || endDate < monthStart) return null;

          const totalHours = (employee.entries || [])
            .filter(entry => entry.date.startsWith(month))
            .reduce((sum, entry) => sum + entry.hours, 0);
          const totalPay = (employee.entries || [])
            .filter(entry => entry.date.startsWith(month))
            .reduce((sum, entry) => sum + entry.pay, 0);
          const year = monthDate.getFullYear();
          const monthNum = monthDate.getMonth();
          let expectedHours = 0;
          const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
          const isCurrentMonth = month === currentDate.toISOString().slice(0, 7);
          const lastDayToCalculate = isCurrentMonth ? currentDate.getDate() : daysInMonth;

          for (let day = 1; day <= lastDayToCalculate; day++) {
            const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
            const date = new Date(dateStr);
            const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' });
            if (holidays.includes(dateStr) || !regularDays.includes(dayOfWeek) || date < startDate || date > endDate) continue;
            const deptHoursForDate = getDepartmentHours(employee.department, dateStr);
            expectedHours += deptHoursForDate;
          }

          const expectedPay = getSalaryForDate(employee, `${month}-01`);
          const difference = totalPay - expectedPay;
          const ps = (employee.paymentStatus || []).find(p => p.month === month) || { status: 'unpaid', method: '' };

          return (
            <div key={month} className="employee-card">
              <p className="mb-2"><strong>{monthName}</strong></p>
              <p className="mb-1">Total Hours: {totalHours.toFixed(2)}</p>
              <p className="mb-1">Expected Hours: {expectedHours.toFixed(2)}</p>
              <p className="mb-1">Monthly Salary: ₹{expectedPay.toFixed(2)}</p>
              <p className="mb-1">Total Salary: ₹{totalPay.toFixed(2)}</p>
              <p className="mb-1">Salary Difference: ₹{Math.abs(difference).toFixed(2)} {difference >= 0 ? '(Extra)' : '(Less)'}</p>
              <p className="mb-0">Payment Status: {ps.status} {ps.method ? `via ${ps.method}` : ''}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDepartmentEmployeeTable = () => {
    return (
      <div className="department-employee-table">
        <h3 className="h5 fw-semibold mb-3">Department-wise Employee List</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Employees</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => (
              <tr key={dept.name}>
                <td>{dept.name}</td>
                <td>
                  {employees
                    .filter(emp => emp.department === dept.name)
                    .map(emp => (
                      <span
                        key={emp.name}
                        className={`employee-name ${selectedDeptEmployee === emp.name ? 'selected' : ''} ${emp.endDate ? 'inactive' : ''}`}
                        onClick={() => showDeptEmployeeDetails(emp.name)}
                      >
                        {emp.name}{emp.endDate ? ' (Inactive)' : ''}
                      </span>
                    ))
                    .reduce((prev, curr, i) => [prev, i > 0 ? ', ' : '', curr], [])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDeptEmployeeDetails = () => {
    const employee = employees.find(emp => emp.name === selectedDeptEmployee);
    if (!employee) return null;

    return (
      <div className="employee-details-card">
        <h4 className="h5 fw-semibold mb-3">{employee.name}'s Details</h4>
        <p className="mb-1"><strong>Department:</strong> {employee.department}</p>
        <p className="mb-1"><strong>Start Date:</strong> {employee.startDate}</p>
        {employee.endDate && <p className="mb-1"><strong>End Date:</strong> {employee.endDate}</p>}
        <p className="mb-1"><strong>Current Salary:</strong> ₹{employee.baseSalary.toFixed(2)}</p>
        <p className="mb-1"><strong>Salary History:</strong></p>
        <ul className="mb-0">
          {employee.salaryHistory
            .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate))
            .map((history, index) => (
              <li key={index}>₹{history.salary.toFixed(2)} (from {history.effectiveDate})</li>
            ))}
        </ul>
      </div>
    );
  };

const renderMonthlySalaryTable = () => {
  if (!isInitialFetchDone) {
    return <div>Loading salary data...</div>;
  }

  return (
    <div className="monthly-salary-table">
      <h3 className="h5 fw-semibold mb-3">Monthly Salary Details for All Employees</h3>
      <div id="salaryMonthButtons" className="mb-4">
        {months.map(month => (
          <div 
            key={month} 
            className={`month-button ${selectedSalaryMonth === month ? 'active' : ''}`} 
            onClick={() => showSalaryMonth(month)}
          >
            {new Date(`${month}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        ))}
      </div>
      {selectedSalaryMonth && (
        <div className="scroll-table-x">
          <div id={`salaryTable-${selectedSalaryMonth}`}>
            <h4 className="h5 fw-semibold mb-3">{new Date(`${selectedSalaryMonth}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h4>
            <div className="mb-3">
              <button className={`dept-button ${selectedTab === 'all' ? 'active' : ''}`} onClick={() => setSelectedTab('all')}>All</button>
              <button className={`dept-button ${selectedTab === 'paid' ? 'active' : ''}`} onClick={() => {
                setSelectedTab('paid');
                if (!['cash', 'bank', 'all'].includes(selectedPaidSubTab)) setSelectedPaidSubTab('cash');
              }}>Paid</button>
              <button className={`dept-button ${selectedTab === 'unpaid' ? 'active' : ''}`} onClick={() => setSelectedTab('unpaid')}>Unpaid</button>
            </div>
            {selectedTab === 'paid' && (
              <div className="mb-3">
                <button className={`dept-button ${selectedPaidSubTab === 'cash' ? 'active' : ''}`} onClick={() => setSelectedPaidSubTab('cash')}>Cash</button>
                <button className={`dept-button ${selectedPaidSubTab === 'bank' ? 'active' : ''}`} onClick={() => setSelectedPaidSubTab('bank')}>Bank</button>
                <button className={`dept-button ${selectedPaidSubTab === 'all' ? 'active' : ''}`} onClick={() => setSelectedPaidSubTab('all')}>All</button>
              </div>
            )}
            {selectedTab === 'all' && (
              <div className="mb-3">
                <button className={`edit-button action-button ${!!editStates[`salary-${selectedSalaryMonth}`] ? 'hidden' : ''}`} onClick={() => startEditSalary(selectedSalaryMonth)}>Edit Payments</button>
                <button className={`save-button btn btn-success ${!!editStates[`salary-${selectedSalaryMonth}`] ? '' : 'hidden'}`} onClick={() => saveEditSalary(selectedSalaryMonth)}>Save</button>
                <button className={`cancel-button btn btn-danger ${!!editStates[`salary-${selectedSalaryMonth}`] ? '' : 'hidden'}`} onClick={() => cancelEditSalary(selectedSalaryMonth)}>Cancel</button>
              </div>
            )}
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Employee Name</th>
                  <th>Total Salary (₹)</th>
                  <th>Payment Status</th>
                  {selectedTab !== 'unpaid' && <th>Method</th>}
                </tr>
              </thead>
              <tbody>
                {departments
                  .filter(dept => employees.some(emp => {
                    const ps = (emp.paymentStatus || []).find(p => p.month === selectedSalaryMonth) || { status: 'unpaid', method: '' };
                    const active = new Date(emp.startDate) <= new Date(`${selectedSalaryMonth}-01`) && (!emp.endDate || new Date(emp.endDate) >= new Date(`${selectedSalaryMonth}-01`));
                    let filter = active;
                    if (selectedTab === 'paid') {
                      filter = filter && ps.status === 'paid' && (selectedPaidSubTab === 'all' ? true : ps.method === selectedPaidSubTab);
                    } else if (selectedTab === 'unpaid') {
                      filter = filter && ps.status === 'unpaid';
                    }
                    return emp.department === dept.name && filter;
                  }))
                  .map(dept => (
                    <React.Fragment key={dept.name}>
                      {employees
                        .filter(emp => {
                          const ps = (emp.paymentStatus || []).find(p => p.month === selectedSalaryMonth) || { status: 'unpaid', method: '' };
                          const active = new Date(emp.startDate) <= new Date(`${selectedSalaryMonth}-01`) && (!emp.endDate || new Date(emp.endDate) >= new Date(`${selectedSalaryMonth}-01`));
                          let filter = active;
                          if (selectedTab === 'paid') {
                            filter = filter && ps.status === 'paid' && (selectedPaidSubTab === 'all' ? true : ps.method === selectedPaidSubTab);
                          } else if (selectedTab === 'unpaid') {
                            filter = filter && ps.status === 'unpaid';
                          }
                          return emp.department === dept.name && filter;
                        })
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(emp => {
                          const totalPay = (emp.entries || [])
                            .filter(entry => entry.date.startsWith(selectedSalaryMonth))
                            .reduce((sum, entry) => sum + entry.pay, 0);
                          const ps = (emp.paymentStatus || []).find(p => p.month === selectedSalaryMonth) || { status: 'unpaid', method: '' };
                          const isEditing = !!editStates[`salary-${selectedSalaryMonth}`];
                          const cellKey = emp.name;
                          const cellState = isEditing ? editStates[`salary-${selectedSalaryMonth}`]?.[cellKey] : null;
                          const showMethod = cellState ? cellState.status === 'paid' : ps.status === 'paid';

                          return (
                            <tr key={`${dept.name}-${emp.name}`}>
                              <td>{dept.name}</td>
                              <td>{emp.name}{emp.endDate ? ' (Inactive)' : ''}</td>
                              <td>₹{totalPay.toFixed(2)}</td>
                              <td>
                                {isEditing ? (
                                  <select
                                    className="form-select"
                                    value={cellState ? cellState.status : ps.status}
                                    onChange={(e) => {
                                      const newStatus = e.target.value;
                                      setEditStates(prev => ({
                                        ...prev,
                                        [`salary-${selectedSalaryMonth}`]: {
                                          ...prev[`salary-${selectedSalaryMonth}`],
                                          [cellKey]: {
                                            ...prev[`salary-${selectedSalaryMonth}`][cellKey],
                                            status: newStatus,
                                            method: newStatus === 'paid' ? (prev[`salary-${selectedSalaryMonth}`][cellKey]?.method || 'bank') : '',
                                          }
                                        }
                                      }));
                                    }}
                                  >
                                    <option value="unpaid">Unpaid</option>
                                    <option value="paid">Paid</option>
                                  </select>
                                ) : (
                                  ps.status
                                )}
                              </td>
                              {selectedTab !== 'unpaid' && (
                                <td>
                                  {showMethod ? (
                                    isEditing ? (
                                      <select
                                        className="form-select"
                                        value={cellState ? cellState.method : (ps.method || '')}
                                        onChange={(e) => {
                                          setEditStates(prev => ({
                                            ...prev,
                                            [`salary-${selectedSalaryMonth}`]: {
                                              ...prev[`salary-${selectedSalaryMonth}`],
                                              [cellKey]: {
                                                ...prev[`salary-${selectedSalaryMonth}`][cellKey],
                                                method: e.target.value,
                                              }
                                            }
                                          }));
                                        }}
                                      >
                                        <option value="bank">Bank</option>
                                        <option value="cash">Cash</option>
                                        <option value="all">All</option>
                                      </select>
                                    ) : (
                                      ps.method || ''
                                    )
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  ))}
                  <tr className="total-row">
                    <td colSpan="2"><strong>Total Salary</strong></td>
                    <td><strong>₹{employees
                      .filter(emp => {
                        const ps = (emp.paymentStatus || []).find(p => p.month === selectedSalaryMonth) || { status: 'unpaid', method: '' };
                        const active = new Date(emp.startDate) <= new Date(`${selectedSalaryMonth}-01`) && (!emp.endDate || new Date(emp.endDate) >= new Date(`${selectedSalaryMonth}-01`));
                        let filter = active;
                        if (selectedTab === 'paid') {
                          filter = filter && ps.status === 'paid' && (selectedPaidSubTab === 'all' ? true : ps.method === selectedPaidSubTab);
                        } else if (selectedTab === 'unpaid') {
                          filter = filter && ps.status === 'unpaid';
                        }
                        return filter;
                      })
                      .reduce((sum, emp) => {
                        const entries = (emp.entries || []).filter(entry => entry.date.startsWith(selectedSalaryMonth));
                        return sum + entries.reduce((entrySum, entry) => entrySum + entry.pay, 0);
                      }, 0)
                      .toFixed(2)}</strong></td>
                    <td colSpan={selectedTab === 'unpaid' ? 1 : 2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="container py-5">
      <h1 className="display-5 fw-semibold mb-5">Employee Salary Calculator</h1>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Add Employee</h2>
        <div className="row g-4">
          <div className="col-12 col-md-3"><input id="newEmpName" type="text" placeholder="Employee Name" className="form-control" /></div>
          <div className="col-12 col-md-2"><input id="newEmpSalary" type="number" placeholder="Salary (₹)" className="form-control" defaultValue="60000" /></div>
          <div className="col-12 col-md-2"><input id="startDate" type="date" placeholder="Start Date" className="form-control" /></div>
          <div className="col-12 col-md-3"><select id="department" className="form-select">{departments.map(dept => <option key={dept.name} value={dept.name}>{dept.name}</option>)}</select></div>
          <div className="col-12 col-md-2"><button onClick={addEmployee} className="action-button w-100">Add Employee</button></div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Mark Employee Inactive</h2>
        <div className="row g-4">
          <div className="col-12 col-md-4"><select id="inactiveEmpSelect" className="form-select">{employees.filter(emp => !emp.endDate).map(emp => <option key={emp.name} value={emp.name}>{emp.name}</option>)}</select></div>
          <div className="col-12 col-md-4"><input id="inactiveDate" type="date" placeholder="End Date" className="form-control" /></div>
          <div className="col-12 col-md-4"><button onClick={markInactive} className="cancel-button w-100">Mark Inactive</button></div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Update Employee Salary</h2>
        <div className="row g-4">
          <div className="col-12 col-md-3"><select id="updateEmpSelect" className="form-select">{employees.filter(emp => !emp.endDate).map(emp => <option key={emp.name} value={emp.name}>{emp.name}</option>)}</select></div>
          <div className="col-12 col-md-3"><input id="newSalary" type="number" placeholder="New Salary (₹)" className="form-control" /></div>
          <div className="col-12 col-md-3"><input id="salaryEffectiveDate" type="date" placeholder="Effective Date" className="form-control" /></div>
          <div className="col-12 col-md-3"><button onClick={updateSalary} className="action-button w-100">Update Salary</button></div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Transfer Employee Department</h2>
        <div className="row g-4">
          <div className="col-12 col-md-4"><select id="transferEmpSelect" className="form-select">{employees.filter(emp => !emp.endDate).map(emp => <option key={emp.name} value={emp.name}>{emp.name}</option>)}</select></div>
          <div className="col-12 col-md-4"><select id="newDepartment" className="form-select">{departments.map(dept => <option key={dept.name} value={dept.name}>{dept.name}</option>)}</select></div>
          <div className="col-12 col-md-4"><button onClick={transferDepartment} className="action-button w-100">Transfer</button></div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Manage Departments</h2>
        {updateDepartmentSummary()}
        <div className="row g-4">
          <div className="col-12 col-md-3"><input id="newDeptName" type="text" placeholder="New Department Name" className="form-control" /></div>
          <div className="col-12 col-md-2"><input id="newDeptHours" type="number" placeholder="Daily Hours" className="form-control" defaultValue="12" /></div>
          <div className="col-12 col-md-2"><button onClick={addDepartment} className="action-button w-100">Add Department</button></div>
          <div className="col-12 col-md-3"><select id="deleteDeptSelect" className="form-select">{departments.map(dept => <option key={dept.name} value={dept.name}>{dept.name}</option>)}</select></div>
          <div className="col-12 col-md-2"><button onClick={deleteDepartment} className="cancel-button w-100">Delete Department</button></div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Update Department Hours</h2>
        <div className="row g-4">
          <div className="col-12 col-md-3"><select id="updateDeptSelect" className="form-select">{departments.map(dept => <option key={dept.name} value={dept.name}>{dept.name}</option>)}</select></div>
          <div className="col-12 col-md-3"><input id="updateDeptHours" type="number" placeholder="New Daily Hours" className="form-control" /></div>
          <div className="col-12 col-md-3"><input id="updateDeptDate" type="date" placeholder="Effective Date" className="form-control" /></div>
          <div className="col-12 col-md-3"><button onClick={updateDepartmentHours} className="action-button w-100">Update Hours</button></div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Add Holiday</h2>
        <div className="row g-4">
          <div className="col-12 col-md-6"><input id="holidayDate" type="date" placeholder="Holiday Date" className="form-control" /></div>
          <div className="col-12 col-md-6"><button onClick={addHoliday} className="action-button w-100">Add Holiday</button></div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Department Employee List</h2>
        {renderDepartmentEmployeeTable()}
        <div id="deptEmployeeDetails" className="mt-4">{selectedDeptEmployee && renderDeptEmployeeDetails()}</div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Monthly Salary Summary for All Employees</h2>
        {renderMonthlySalaryTable()}
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Mass Entry for Department</h2>
        <div className="row g-4">
          <div className="col-12 col-md-4"><select id="massDeptSelect" className="form-select">{departments.map(dept => <option key={dept.name} value={dept.name}>{dept.name}</option>)}</select></div>
          <div className="col-12 col-md-3"><input id="massEntryDate" type="date" placeholder="Date" className="form-control" /></div>
          <div className="col-12 col-md-3"><input id="massEntryHours" type="number" placeholder="Hours" className="form-control" min="0" max="24" step="0.5" /></div>
          <div className="col-12 col-md-2"><button onClick={addMassEntry} className="action-button w-100">Add Mass Entry</button></div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Monthly Attendance by Department</h2>
        {generateMonthTables()}
      </div>
      <div className="section-card">
        <h2 className="h4 fw-semibold mb-4">Employee Salary Summary</h2>
        <div className="employee-list mb-4">
          <div id="employeeList" className="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4">
            {employees.map(emp => (
              <div key={emp.name} className={`employee-card ${selectedEmployee === emp.name ? 'selected' : ''} ${emp.endDate ? 'inactive' : ''}`} onClick={() => showEmployeeDetails(emp.name)}>
                <p className="mb-2"><strong>{emp.name}</strong>{emp.endDate ? ' (Inactive)' : ''}</p>
                <p className="mb-1">Department: {emp.department}</p>
                <p className="mb-1">Start Date: {emp.startDate}</p>
                {emp.endDate && <p className="mb-0">End Date: {emp.endDate}</p>}
              </div>
            ))}
          </div>
        </div>
        <div id="employeeDetails">{selectedEmployee && renderEmployeeDetails()}</div>
      </div>
      {showModal && (
        <div id="modal" className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <p id="modalMessage" className="mb-3">{modalMessage}</p>
            <button onClick={closeModal} className="action-button">OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;