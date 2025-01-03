import React, { useState, useEffect } from 'react';
import { getToken } from '../utils/auth';
import { useNavigate } from 'react-router-dom';
import './Tutors.css';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { toast } from 'react-hot-toast';

const Tutors = () => {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTutor, setExpandedTutor] = useState(null);
  const [tutorDetails, setTutorDetails] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [deletingSlotId, setDeletingSlotId] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingSlotId, setBookingSlotId] = useState(null);
  const [reschedulingSlotId, setReschedulingSlotId] = useState(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [bookedSlots, setBookedSlots] = useState({});
  const [bookedSessions, setBookedSessions] = useState([]);
  const [checkedSlots, setCheckedSlots] = useState({});
  const [weeklyAvailability, setWeeklyAvailability] = useState({});
  const navigate = useNavigate();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  useEffect(() => {
    fetchTutors();
  }, []);

  const fetchTutors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/users/role/Instructor', {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tutors: ${response.status}`);
      }

      const data = await response.json();
      setTutors(data.users || []);
    } catch (error) {
      console.error('Error fetching tutors:', error);
      setError('Failed to load tutors');
      setTutors([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDateString = (date) => {
    return date.toISOString().split('T')[0];
  };

  const fetchTutorDetails = async (tutorId) => {
    try {
      if (!tutorId) return;

      const headers = {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      };

      const [classesRes, coursesRes, scheduleRes, experienceRes] = await Promise.all([
        fetch(`http://localhost:5000/api/classes/instructor/${tutorId}`, { headers }),
        fetch(`http://localhost:5000/api/courses?instructor_id=${tutorId}`, { headers }),
        fetch(`http://localhost:5000/api/weekly-availability/schedule/${tutorId}`, { headers }),
        fetch(`http://localhost:5000/api/experiences/instructor/${tutorId}`, { headers })
      ]);

      const [classesData, coursesData, scheduleData, experienceData] = await Promise.all([
        classesRes.json(),
        coursesRes.json(),
        scheduleRes.json(),
        experienceRes.json()
      ]);

      setTutorDetails(prevDetails => ({
        ...prevDetails,
        [tutorId]: {
          classes: classesData.classes || [],
          courses: Array.isArray(coursesData) ? coursesData : [],
          schedule: scheduleData.weekly_schedule?.schedule || [],
          experience: experienceData.experiences || []
        }
      }));

      // Check availability for all slots on the selected date
      const selectedDateSlots = getDateSlots(tutorId, selectedDate);
      await Promise.all(
        selectedDateSlots.map(slot => 
          checkSlotAvailability(slot.slot_id, formatDate(selectedDate))
        )
      );

    } catch (error) {
      console.error('Error fetching tutor details:', error);
      setError(`Failed to load tutor details: ${error.message}`);
    }
  };

  const handleExpandTutor = async (tutorId) => {
    try {
      if (expandedTutor === tutorId) {
        setExpandedTutor(null);
      } else {
        setExpandedTutor(tutorId);
        await fetchTutorDetails(tutorId);
      }
    } catch (error) {
      console.error('Error handling tutor expansion:', error);
      setError('Failed to load tutor details');
    }
  };

  const isSameDay = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const checkSlotAvailability = async (slotId, date) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/bookings/check-slot/${slotId}?date=${date}&instructor_id=${expandedTutor}`,
        {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (data.success) {
        const slotDetails = data.slot_details;
        const slotKey = `${slotId}-${date}`;
        
        setCheckedSlots(prev => ({
          ...prev,
          [slotKey]: {
            is_booked: slotDetails.is_booked,
            booking_id: slotDetails.booking?.id || null,
            student: slotDetails.booking?.student || null,
            status: slotDetails.booking?.status || null,
            start_time: slotDetails.start_time,
            end_time: slotDetails.end_time
          }
        }));

        return {
          is_booked: slotDetails.is_booked,
          booking_id: slotDetails.booking?.id || null
        };
      }
      return { is_booked: false, booking_id: null };
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return { is_booked: false, booking_id: null };
    }
  };

  const getDateSlots = (tutorId, date) => {
    const formattedDate = formatDate(new Date(date));
    console.log('Getting slots for date:', formattedDate);
    console.log('Weekly availability:', weeklyAvailability);
    
    const slotsForDate = weeklyAvailability[formattedDate] || [];
    console.log('Slots found for date:', slotsForDate);

    return slotsForDate.map(slot => {
      const slotKey = `${slot.slot_id}-${formattedDate}`;
      const slotStatus = checkedSlots[slotKey];
      
      return {
        id: slot.slot_id,
        slot_id: slot.slot_id,
        date: formattedDate,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_booked: !slot.is_available,
        booking_id: slotStatus?.booking_id
      };
    });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTileContent = ({ date, view }, tutorId) => {
    if (view !== 'month') return null;
    const slots = getDateSlots(tutorId, date);
    if (!slots) return null;

    return (
      <div className="calendar-tile-content">
        {slots.map((slot, index) => (
          <div 
            key={index}
            className={`slot-indicator ${slot.is_booked ? 'booked' : 'available'}`}
          />
        ))}
      </div>
    );
  };

  const getTileClassName = ({ date, view }, tutorId) => {
    if (view !== 'month') return '';
    const slots = getDateSlots(tutorId, date);
    if (!slots) return '';

    const hasAvailableSlots = slots.some(slot => !slot.is_booked);
    return hasAvailableSlots ? 'has-available-slots' : '';
  };

  const handleSlotClick = async (slot, tutorId) => {
    console.log('Slot clicked:', slot);
    
    if (reschedulingSlotId) {
      await handleReschedule(reschedulingSlotId, slot);
    } else if (!slot.is_booked) {
      await bookSession(tutorId, slot);
    }
  };

  const bookSession = async (instructorId, slot) => {
    try {
      console.log('Starting booking process:', {
        instructorId,
        slot,
        slotId: slot.slot_id,
        date: slot.date
      });

      setBookingSlotId(slot.id);
      setBookingError(null);
      
      if (!slot.slot_id || !slot.date) {
        throw new Error('Invalid slot data');
      }

      const requestBody = {
        instructor_id: parseInt(instructorId),
        slot_id: parseInt(slot.slot_id),
        date: slot.date
      };

      console.log('Booking request body:', requestBody);

      const response = await fetch('http://localhost:5000/api/bookings/book', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Booking response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to book session');
      }

      if (data.success && data.booking) {
        setWeeklyAvailability(prev => {
          const newAvailability = { ...prev };
          const bookingDate = data.booking.date;
          
          if (newAvailability[bookingDate]) {
            newAvailability[bookingDate] = newAvailability[bookingDate].map(s => 
              s.slot_id === slot.slot_id 
                ? { ...s, is_available: false }
                : s
            );
          }
          
          return newAvailability;
        });

        const slotKey = `${slot.slot_id}-${slot.date}`;
        setCheckedSlots(prev => ({
          ...prev,
          [slotKey]: {
            is_booked: true,
            booking_id: data.booking.id,
            slot_id: slot.slot_id,
            date: slot.date,
            start_time: data.booking.start_time,
            end_time: data.booking.end_time
          }
        }));
        
        toast.success('Session booked successfully!');
        
        await fetchWeeklySlots(instructorId, new Date(slot.date));
      } else {
        throw new Error('Booking failed: Invalid response format');
      }
    } catch (error) {
      console.error('Booking error:', error);
      setBookingError(error.message || 'Failed to book session');
      toast.error(error.message || 'Failed to book session');
    } finally {
      setBookingSlotId(null);
    }
  };

  const deleteBooking = async (bookingId) => {
    try {
      console.log('Attempting to delete booking:', bookingId);
      
      if (!bookingId) {
        console.error('No booking ID provided');
        return;
      }

      setDeletingSlotId(bookingId);

      const response = await fetch('http://localhost:5000/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ booking_id: bookingId })
      });

      const data = await response.json();
      console.log('Delete booking response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel booking');
      }

      if (data.success) {
        toast.success('Booking cancelled successfully');
        
        // Refresh the weekly availability
        if (expandedTutor && selectedDate) {
          await fetchWeeklySlots(expandedTutor, selectedDate);
        }
      } else {
        throw new Error(data.message || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Delete booking error:', error);
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setDeletingSlotId(null);
    }
  };

  const handleReschedule = async (oldSlotId, newSlot) => {
    try {
      console.log('Starting reschedule process:', { 
        oldSlotId: oldSlotId,
        newSlotId: newSlot.slot_id,
        newSlot: newSlot
      });
      
      setIsRescheduling(true);

      // Ensure we're using the correct slot IDs
      const requestBody = {
        old_slot_id: parseInt(oldSlotId),
        new_slot_id: parseInt(newSlot.slot_id)
      };

      console.log('Sending reschedule request:', requestBody);

      const response = await fetch('http://localhost:5000/api/availability/reschedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Reschedule API response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reschedule booking');
      }

      if (data.success) {
        // Get the dates from the response
        const oldDate = data.booking.old_schedule.date;
        const newDate = data.booking.new_schedule.date;
        
        console.log('Updating slots with dates:', {
          oldDate,
          newDate,
          oldSlotId,
          newSlotId: newSlot.slot_id,
          bookingId: data.booking.id
        });

        // Update weekly availability
        await fetchWeeklySlots(expandedTutor, selectedDate);

        // Clear rescheduling state
        setReschedulingSlotId(null);
        toast.success('Session rescheduled successfully!');
      } else {
        throw new Error('Rescheduling failed: Invalid response format');
      }
    } catch (error) {
      console.error('Reschedule error:', error);
      toast.error(error.message || 'Failed to reschedule booking');
    } finally {
      setIsRescheduling(false);
    }
  };

  const fetchAvailableSlots = async (tutorId, weekStart) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/availability/available-slots/${tutorId}?week=${weekStart}`,
        {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setCheckedSlots(prev => {
          const newSlots = { ...prev };
          Object.entries(data.available_slots).forEach(([date, slots]) => {
            slots.forEach(slot => {
              const slotKey = `${slot.slot_id}-${date}`;
              newSlots[slotKey] = {
                is_booked: !slot.is_available,
                slot_id: slot.slot_id,
                start_time: slot.start_time,
                end_time: slot.end_time,
                date: date
              };
            });
          });
          return newSlots;
        });
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      return null;
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    return d;
  };

  const fetchWeeklySlots = async (tutorId, date) => {
    try {
      const weekStart = getWeekStart(new Date(date));
      const formattedWeekStart = formatDate(weekStart);
      
      console.log('Fetching slots for week starting:', formattedWeekStart);

      const response = await fetch(
        `http://localhost:5000/api/availability/available-slots/${tutorId}?week=${formattedWeekStart}`,
        {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      console.log('Weekly availability response:', data);

      if (data.success) {
        // Store the available slots with their dates
        setWeeklyAvailability(data.available_slots);
        return data.available_slots;
      }
      return null;
    } catch (error) {
      console.error('Error fetching weekly slots:', error);
      return null;
    }
  };

  useEffect(() => {
    if (expandedTutor && selectedDate) {
      console.log('Selected date changed to:', selectedDate);
      fetchWeeklySlots(expandedTutor, selectedDate);
    }
  }, [expandedTutor, selectedDate]);

  return (
    <div className="tutors-container">
      <div className="tutors-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h2>Available Instructors</h2>
      </div>
      
      {loading ? (
        <p>Loading instructors...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : (
        <div className="tutors-grid">
          {tutors.map((tutor) => (
            <div key={tutor.id} className="tutor-card">
              <div className="tutor-info">
                <div className="tutor-header">
                  <div className="tutor-image">
                    <img 
                      src={tutor.image_url || 'default-avatar.png'} 
                      alt={tutor.name}
                      onError={(e) => {
                        e.target.src = 'default-avatar.png';
                      }}
                    />
                  </div>
                  <div className="tutor-basic-info">
                    <h3>{`${tutor.first_name} ${tutor.last_name}`}</h3>
                    <p>{tutor.email}</p>
                    <p>{tutor.role}</p>
                  </div>
                </div>
              </div>

              {expandedTutor === tutor.id && tutorDetails[tutor.id] && (
                <div className="expanded-details">
                  <div className="detail-section">
                    <h4>Grades Taught</h4>
                    <ul>
                      {tutorDetails[tutor.id].classes.map((cls) => (
                        <li key={cls.id}>
                          {cls.grade_level} {cls.section}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h4>Courses</h4>
                    <ul>
                      {tutorDetails[tutor.id].courses.map((course) => (
                        <li key={course.id}>
                          <strong>{course.title}</strong>
                          <p>{course.description}</p>
                          <small>
                            {new Date(course.start_date).toLocaleDateString()} - 
                            {new Date(course.end_date).toLocaleDateString()}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h4>Experience</h4>
                    <div className="experience-list">
                      {tutorDetails[tutor.id].experience.map((exp) => (
                        <div key={exp.id} className="experience-item">
                          <h3>{exp.title}</h3>
                          <p>{exp.company} - {exp.location}</p>
                          <p className="date">
                            {new Date(exp.start_date).toLocaleDateString()} - 
                            {exp.is_current ? 'Present' : new Date(exp.end_date).toLocaleDateString()}
                          </p>
                          <p>{exp.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section schedule-section">
                    <h4>Schedule</h4>
                    <div className="calendar-wrapper">
                      <Calendar
                        onChange={setSelectedDate}
                        value={selectedDate}
                        locale="en-US"
                        calendarType="iso8601"
                        tileClassName={({ date }) => {
                          const formattedDate = date.toLocaleDateString('en-CA');
                          const hasSlots = tutorDetails[tutor.id]?.schedule?.some(dateObj => 
                            Object.keys(dateObj)[0] === formattedDate
                          );
                          return hasSlots ? 'has-available-slots' : '';
                        }}
                        tileContent={({ date }) => {
                          const formattedDate = date.toLocaleDateString('en-CA');
                          const hasSlots = tutorDetails[tutor.id]?.schedule?.some(dateObj => 
                            Object.keys(dateObj)[0] === formattedDate
                          );
                          return hasSlots ? <div className="availability-dot" /> : null;
                        }}
                        minDate={new Date()}
                        maxDetail="month"
                        minDetail="month"
                        showNeighboringMonth={true}
                        formatShortWeekday={(locale, date) => 
                          ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]
                        }
                      />
                    </div>
                    
                    <div className="schedule-container">
                      {reschedulingSlotId && (
                        <div className="reschedule-header">
                          <div className="reschedule-banner">
                            <span>🔄 Rescheduling session...</span>
                            <button 
                              className="exit-reschedule-button"
                              onClick={() => setReschedulingSlotId(null)}
                            >
                              ✕ Cancel Rescheduling
                            </button>
                          </div>
                        </div>
                      )}

                      <div className={`slots-list ${reschedulingSlotId ? 'reschedule-mode' : ''}`}>
                        {getDateSlots(tutor.id, selectedDate).map((slot) => (
                          <div 
                            key={`${slot.date}-${slot.start_time}`}
                            className={`slot ${slot.is_booked ? 'booked' : 'available'}`}
                          >
                            <div className="slot-time">
                              {`${slot.start_time} - ${slot.end_time}`}
                            </div>
                            
                            <div className="slot-actions">
                              {slot.is_booked ? (
                                <div className="booked-slot-actions">
                                  <button 
                                    className="cancel-button"
                                    onClick={() => deleteBooking(slot.booking_id)}
                                    disabled={deletingSlotId === slot.booking_id || isRescheduling}
                                  >
                                    {deletingSlotId === slot.booking_id ? 'Cancelling...' : 'Cancel'}
                                  </button>
                                  <button 
                                    className="reschedule-button"
                                    onClick={() => {
                                      console.log('Starting reschedule for slot:', slot);
                                      setReschedulingSlotId(slot.slot_id);
                                    }}
                                    disabled={isRescheduling}
                                  >
                                    Reschedule
                                  </button>
                                </div>
                              ) : (
                                <div 
                                  className="available-slot"
                                  onClick={() => handleSlotClick(slot, tutor.id)}
                                >
                                  <span className="available-text">
                                    {reschedulingSlotId ? 'Click to reschedule here' : 'Available'}
                                  </span>
                                  <span className="book-text">
                                    {reschedulingSlotId ? '→' : 'Click to book →'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button 
                className="expand-button"
                onClick={() => handleExpandTutor(tutor.id)}
              >
                {expandedTutor === tutor.id ? 'Show Less' : 'Show More'}
              </button>
            </div>
          ))}
        </div>
      )}
      {bookingError && (
        <div className="error-message">
          {bookingError}
        </div>
      )}
      {bookingSuccess && (
        <div className="success-message">
          {bookingSuccess}
        </div>
      )}
    </div>
  );
};

export default Tutors; 