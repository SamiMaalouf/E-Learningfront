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
  const navigate = useNavigate();

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
        fetch(`http://localhost:5000/api/availability/instructor/${tutorId}`, { headers }),
        fetch(`http://localhost:5000/api/experiences/instructor/${tutorId}`, { headers })
      ]);

      const classesData = await classesRes.json();
      const coursesData = await coursesRes.json();
      const scheduleData = await scheduleRes.json();
      const experienceData = await experienceRes.json();

      setTutorDetails(prevDetails => ({
        ...prevDetails,
        [tutorId]: {
          classes: classesData.classes || [],
          courses: Array.isArray(coursesData) ? coursesData : [],
          schedule: scheduleData.available_slots || [],
          experience: experienceData.experiences || []
        }
      }));

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

  const getDateSlots = (tutorId, date) => {
    if (!tutorDetails[tutorId]?.schedule) return [];
    
    // Create a new date object and set it to midnight in the local timezone
    const localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
    
    // Format the date to YYYY-MM-DD in the local timezone
    const formattedDate = localDate.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
    
    console.log('Looking for date:', formattedDate);
    console.log('Available dates:', tutorDetails[tutorId].schedule.map(obj => Object.keys(obj)[0]));
    
    const daySchedule = tutorDetails[tutorId].schedule.find(dateObj => {
      const dateKey = Object.keys(dateObj)[0];
      console.log('Comparing:', dateKey, formattedDate);
      return dateKey === formattedDate;
    });
    
    if (daySchedule) {
      const slots = daySchedule[formattedDate]?.slots || [];
      console.log('Found slots for', formattedDate, ':', slots);
      return slots;
    }
    
    return [];
  };

  const formatDate = (date) => {
    return new Date(date).toISOString().split('T')[0];
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

  const bookSession = async (instructorId, slotId) => {
    try {
      setBookingSlotId(slotId);
      setBookingError(null);
      
      const response = await fetch('http://localhost:5000/api/availability/book', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instructor_id: instructorId,
          time_slot_id: slotId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to book session');
      }

      const data = await response.json();
      setBookingSuccess('Session booked successfully!');
      
      // Refresh the tutor details to update the availability
      await fetchTutorDetails(instructorId);
    } catch (error) {
      console.error('Booking error:', error);
      setBookingError(error.message || 'Failed to book session');
    } finally {
      setBookingSlotId(null);
    }
  };

  const deleteBooking = async (slotId) => {
    try {
      setDeletingSlotId(slotId);
      setBookingError(null);

      const response = await fetch(`http://localhost:5000/api/availability/appointment/${slotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel booking');
      }

      setBookingSuccess('Booking cancelled successfully!');
      
      // Refresh the tutor details
      await fetchTutorDetails(expandedTutor);
    } catch (error) {
      console.error('Cancellation error:', error);
      setBookingError(error.message || 'Failed to cancel booking');
    } finally {
      setDeletingSlotId(null);
    }
  };

  const rescheduleSession = async (currentSlotId, newSlotId, tutorId) => {
    try {
      setIsRescheduling(true);
      const token = localStorage.getItem('token');
      
      console.log('Attempting to reschedule:', {
        current_slot_id: currentSlotId,
        new_slot_id: newSlotId,
        tutorId: tutorId
      });

      const response = await fetch('http://localhost:5000/api/availability/reschedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_slot_id: currentSlotId,
          new_slot_id: newSlotId
        })
      });

      const data = await response.json();
      console.log('API Response:', data);

      if (data.success) {
        toast.success(`Successfully rescheduled from ${data.rescheduled.from.start} to ${data.rescheduled.to.start}`);
        
        // Pass tutorId to fetchTutorDetails
        if (typeof fetchTutorDetails === 'function') {
          await fetchTutorDetails(tutorId);
        }
        
        setReschedulingSlotId(null);
      } else {
        throw new Error('Rescheduling failed');
      }

    } catch (error) {
      console.error('Reschedule error:', error);
      toast.error('Failed to reschedule session');
    } finally {
      setIsRescheduling(false);
    }
  };

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
                            key={slot.id}
                            className={`slot ${
                              slot.id === reschedulingSlotId ? 'current-slot' : ''
                            } ${slot.is_booked ? 'booked' : 'available'}`}
                          >
                            <div className="slot-time">
                              {`${slot.start} - ${slot.end}`}
                            </div>
                            
                            <div className="slot-actions">
                              {slot.is_booked ? (
                                <>
                                  {slot.id === reschedulingSlotId ? (
                                    <span className="current-slot-label">Current Time</span>
                                  ) : (
                                    <>
                                      <button 
                                        className="cancel-button"
                                        onClick={() => deleteBooking(slot.id)}
                                        disabled={deletingSlotId === slot.id || isRescheduling}
                                      >
                                        Cancel
                                      </button>
                                      {!reschedulingSlotId && (
                                        <button 
                                          className="reschedule-button"
                                          onClick={() => setReschedulingSlotId(slot.id)}
                                        >
                                          Reschedule
                                        </button>
                                      )}
                                    </>
                                  )}
                                </>
                              ) : (
                                reschedulingSlotId ? (
                                  <button
                                    className="confirm-reschedule-button"
                                    onClick={() => {
                                      console.log('Initiating reschedule:', {
                                        from: reschedulingSlotId,
                                        to: slot.id,
                                        tutorId: tutor.id
                                      });
                                      rescheduleSession(reschedulingSlotId, slot.id, tutor.id);
                                    }}
                                    disabled={isRescheduling}
                                  >
                                    {isRescheduling ? 'Rescheduling...' : 'Select This Time →'}
                                  </button>
                                ) : (
                                  <div 
                                    className="available-slot"
                                    onClick={() => !bookingSlotId && bookSession(tutor.id, slot.id)}
                                  >
                                    <span className="available-text">Available</span>
                                    <span className="book-text">Click to book →</span>
                                  </div>
                                )
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