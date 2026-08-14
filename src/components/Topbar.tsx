import React from 'react';

interface TopbarProps {
  tag: string;
  title: string;
  streakDays: number;
}

export const Topbar: React.FC<TopbarProps> = ({ tag, title, streakDays }) => {
  return (
    <header className="main-top-bar">
      <div className="top-bar-left">
        <span className="tag-badge">{tag}</span>
        <h2 className="top-bar-title">{title}</h2>
      </div>
      <div className="top-bar-right">
        <div className="user-streak-badge">
          <span>🔥</span>
          <span>{streakDays} ngày liên tục</span>
        </div>
      </div>
    </header>
  );
};
