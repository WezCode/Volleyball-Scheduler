import React, { useState } from 'react';
import './App.css';

function App() {
  const [teams, setTeams] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [teamInput, setTeamInput] = useState('');

  const addTeam = () => {
    if (teamInput) {
      setTeams([...teams, teamInput]);
      setTeamInput('');
    }
  };

  const generateSchedule = () => {
    const newSchedule = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        newSchedule.push(`${teams[i]} vs ${teams[j]}`);
      }
    }
    setSchedule(newSchedule);
  };

  return (
    <div className="App">
      <h1>Volleyball Scheduler</h1>
      <div>
        <input
          type="text"
          value={teamInput}
          onChange={(e) => setTeamInput(e.target.value)}
          placeholder="Add a team"
        />
        <button onClick={addTeam}>Add Team</button>
      </div>
      <div>
        <button onClick={generateSchedule}>Generate Schedule</button>
      </div>
      <h2>Teams</h2>
      <ul>
        {teams.map((team, index) => (
          <li key={index}>{team}</li>
        ))}
      </ul>
      <h2>Schedule Preview</h2>
      <ul>
        {schedule.map((match, index) => (
          <li key={index}>{match}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;