import React, { useState, useEffect } from 'react';
import { getToken } from '../utils/auth';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Tutors.css';

const Tutors = () => {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTutor, setExpandedTutor] = useState(null);
  const [tutorDetails, setTutorDetails] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSlotId, setBookingSlotId] = useState(null);
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
        },
      });

      if (!response.ok) throw new Error('Failed to fetch instructors');
      const data = await response.json();
      setTutors(data.users || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateString = (date) => {
    return date.toISOString().split('T')[0];
  };

  const fetchTutorDetails = async (tutorId) => {
    try {
      const [classesRes, coursesRes, scheduleRes, experienceRes] = await Promise.all([
        fetch(`http://localhost:5000/api/classes/instructor/${tutorId}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`http://localhost:5000/api/courses?instructor_id=${tutorId}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`http://localhost:5000/api/availability?instructor_id=${tutorId}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`http://localhost:5000/api/experiences/instructor/${tutorId}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
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
          courses: coursesData || [],
          schedule: scheduleData.available_slots || [],
          experience: experienceData.experiences || []
        }
      }));

    } catch (error) {
      console.error('Error fetching tutor details:', error);
    }
  };

  const handleShowMore = async (tutorId) => {
    if (expandedTutor === tutorId) {
      setExpandedTutor(null);
    } else {
      setExpandedTutor(tutorId);
      if (!tutorDetails[tutorId]) {
        await fetchTutorDetails(tutorId);
      }
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
    const schedule = tutorDetails[tutorId]?.schedule || [];
    const startOfDay = new Date(date).setHours(0, 0, 0, 0) / 1000;
    const endOfDay = new Date(date).setHours(23, 59, 59, 999) / 1000;

    for (const daySchedule of schedule) {
      const slots = Object.values(daySchedule)[0].slots;
      if (slots.some(slot => 
        slot.start_epoch >= startOfDay && 
        slot.end_epoch <= endOfDay
      )) {
        return slots;
      }
    }
    return null;
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

  const bookTimeSlot = async (instructorId, slotId) => {
    setBookingSlotId(slotId);
    setBookingError(null);

    try {
      const response = await fetch('http://localhost:5000/api/availability/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          instructor_id: instructorId,
          time_slot_id: slotId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to book slot');
      }

      await fetchTutorDetails(instructorId);
      alert('Slot booked successfully!');

    } catch (error) {
      console.error('Booking error:', error);
      setBookingError(error.message);
      alert(`Failed to book slot: ${error.message}`);
    } finally {
      setBookingSlotId(null);
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
                <h3>{tutor.name}</h3>
                <p>{tutor.email}</p>
                <p>{tutor.role}</p>
              </div>

              {expandedTutor === tutor.id && tutorDetails[tutor.id] && (
                <div className="expanded-details">
                  <div className="detail-section">
                    <h4>Grades Taught</h4>
                    <ul>
                      {tutorDetails[tutor.id].classes.map((cls, index) => (
                        <li key={index}>
                          Grade {cls.grade_name} - Section {cls.section}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h4>Courses Taught</h4>
                    <ul className="courses-list">
                      {tutorDetails[tutor.id].courses.map((course, index) => (
                        <li key={index}>{course.name}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section schedule-section">
                    <h4>Schedule</h4>
                    <div className="calendar-container">
                      <Calendar
                        onChange={setSelectedDate}
                        value={selectedDate}
                        tileContent={({date, view}) => getTileContent({date, view}, tutor.id)}
                        tileClassName={({date, view}) => getTileClassName({date, view}, tutor.id)}
                        minDate={new Date()}
                      />
                    </div>
                    {selectedDate && (
                      <div className="selected-date-slots">
                        <h5>Available Slots for {selectedDate.toLocaleDateString()}</h5>
                        {bookingError && (
                          <div className="booking-error">
                            {bookingError}
                          </div>
                        )}
                        <div className="slots-list">
                          {getDateSlots(tutor.id, selectedDate)?.map((slot) => (
                            <div 
                              key={slot.id}
                              className={`slot ${slot.is_booked ? 'booked' : 'available'}`}
                              onClick={() => {
                                if (!slot.is_booked && bookingSlotId !== slot.id) {
                                  if (window.confirm(`Book slot for ${slot.start} - ${slot.end}?`)) {
                                    bookTimeSlot(tutor.id, slot.id);
                                  }
                                }
                              }}
                            >
                              <span className="slot-time">
                                {`${slot.start} - ${slot.end}`}
                              </span>
                              <span className="slot-status">
                                {slot.is_booked ? 
                                  '(Booked)' : 
                                  bookingSlotId === slot.id ? 
                                    'Booking...' : 
                                    '(Available)'
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="detail-section">
                    <h4>Experience</h4>
                    <ul className="experience-list">
                      {tutorDetails[tutor.id].experience.map((exp, index) => (
                        <li key={index}>{exp.description}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <button 
                className="expand-button"
                onClick={() => handleShowMore(tutor.id)}
              >
                {expandedTutor === tutor.id ? 'Show Less' : 'Show More'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tutors; 