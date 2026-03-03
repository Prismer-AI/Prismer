'use client'

import { cn } from "@/lib/utils";
import React from 'react'

export default function CubeLoader() {
  return (
    <div className='flex flex-col items-center justify-center gap-12 p-12 min-h-[400px] bg-slate-950/0 perspective-container'>
      
      {/* 3D Scene Wrapper */}
      <div className='relative w-24 h-24 flex items-center justify-center preserve-3d'>
        
        {/* THE SPINNING CUBE CONTAINER */}
        <div className='relative w-full h-full preserve-3d animate-cube-spin'>
          
          {/* Internal Core (The energy source) */}
          <div className='absolute inset-0 m-auto w-8 h-8 bg-white rounded-full blur-md shadow-[0_0_40px_rgba(255,255,255,0.8)] animate-pulse-fast' />

          {/* CUBE FACES 
              We wrap each face in a 'side-wrapper' that handles the rotation (facing direction),
              and the inner 'face' handles the breathing (expansion/contraction) animation.
          */}

          {/* Front */}
          <div className='side-wrapper front'>
            <div className='face bg-cyan-500/10 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]' />
          </div>
          
          {/* Back */}
          <div className='side-wrapper back'>
            <div className='face bg-cyan-500/10 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]' />
          </div>

          {/* Right */}
          <div className='side-wrapper right'>
            <div className='face bg-purple-500/10 border-2 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' />
          </div>

          {/* Left */}
          <div className='side-wrapper left'>
            <div className='face bg-purple-500/10 border-2 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' />
          </div>

          {/* Top */}
          <div className='side-wrapper top'>
            <div className='face bg-indigo-500/10 border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]' />
          </div>

          {/* Bottom */}
          <div className='side-wrapper bottom'>
            <div className='face bg-indigo-500/10 border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]' />
          </div>
        </div>

        {/* Floor Shadow (Scales with the breathing) */}
        <div className='absolute -bottom-20 w-24 h-8 bg-black/40 blur-xl rounded-[100%] animate-shadow-breathe' />
      </div>

      {/* Loading Text */}
      <div className='flex flex-col items-center gap-1 mt-2'>
  <h3 className='text-sm font-semibold tracking-[0.3em] text-cyan-300 uppercase'>
    Loading
  </h3>
  <p className='text-xs text-slate-400'>
    Preparing your experience, please wait…
  </p>
</div>

      <style jsx>{`
        .perspective-container {
          perspective: 1200px;
        }

        .preserve-3d {
          transform-style: preserve-3d;
        }

        /* 1. Cube Spin 
          Rotates the entire assembly on X and Y axes 
        */
        @keyframes cubeSpin {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }

        /* 2. Face Breathing 
          Moves the face outward (translateZ) and back.
          Since the parent (.side-wrapper) is already rotated, Z is always "outward" relative to that face.
        */
        @keyframes breathe {
          0%, 100% { transform: translateZ(48px); opacity: 0.8; } /* 48px is half of w-24 (96px) */
          50% { transform: translateZ(80px); opacity: 0.4; border-color: rgba(255,255,255,0.8); }
        }

        @keyframes pulse-fast {
            0%, 100% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes shadow-breathe {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.5); opacity: 0.2; }
        }

        @keyframes glitch {
            0% { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 1px); }
            20% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -1px); }
            40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); }
            60% { clip-path: inset(10% 0 60% 0); transform: translate(2px, -2px); }
            80% { clip-path: inset(30% 0 20% 0); transform: translate(1px, 2px); }
            100% { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 1px); }
        }

        .animate-cube-spin {
          animation: cubeSpin 8s linear infinite;
        }

        .animate-pulse-fast {
            animation: pulse-fast 2s ease-in-out infinite;
        }

        .animate-shadow-breathe {
            animation: shadow-breathe 3s ease-in-out infinite;
        }

        .animate-glitch-text {
            animation: glitch 2s infinite linear alternate-reverse;
        }

        /* Positioning the Sides */
        .side-wrapper {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
        }

        .face {
          width: 100%;
          height: 100%;
          position: absolute;
          /* The 'breathe' animation is applied here */
          animation: breathe 3s ease-in-out infinite;
          backdrop-filter: blur(2px);
        }

        /* Rotations to form the cube structure */
        .front  { transform: rotateY(0deg); }
        .back   { transform: rotateY(180deg); }
        .right  { transform: rotateY(90deg); }
        .left   { transform: rotateY(-90deg); }
        .top    { transform: rotateX(90deg); }
        .bottom { transform: rotateX(-90deg); }
      `}</style>
    </div>
  )
}