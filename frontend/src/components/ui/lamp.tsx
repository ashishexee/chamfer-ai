"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden bg-adam-bg-secondary-dark w-full rounded-md z-0",
        className
      )}
    >
      {/* Faint Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none z-0" />

      {/* Lamp glow — anchored to top */}
      <div className="absolute top-0 left-0 right-0 h-[400px] overflow-hidden z-0">
        <div className="relative w-full h-full flex items-start justify-center isolate">
          {/* Left cone */}
          <motion.div
            initial={{ opacity: 0.3, width: "12rem" }}
            whileInView={{ opacity: 0.6, width: "24rem" }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            style={{ backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))` }}
            className="absolute top-0 right-1/2 h-56 overflow-visible w-[24rem] bg-gradient-conic from-adam-accent via-transparent to-transparent [--conic-position:from_70deg_at_center_top]"
          >
            <div className="absolute w-full left-0 bg-adam-bg-secondary-dark h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
            <div className="absolute w-40 h-full left-0 bg-adam-bg-secondary-dark bottom-0 z-20 [mask-image:linear-gradient(to_right,white,transparent)]" />
          </motion.div>

          {/* Right cone */}
          <motion.div
            initial={{ opacity: 0.3, width: "12rem" }}
            whileInView={{ opacity: 0.6, width: "24rem" }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            style={{ backgroundImage: `conic-gradient(var(--conic-position), var(--tw-gradient-stops))` }}
            className="absolute top-0 left-1/2 h-56 w-[24rem] bg-gradient-conic from-transparent via-transparent to-adam-accent [--conic-position:from_290deg_at_center_top]"
          >
            <div className="absolute w-40 h-full right-0 bg-adam-bg-secondary-dark bottom-0 z-20 [mask-image:linear-gradient(to_left,white,transparent)]" />
            <div className="absolute w-full right-0 bg-adam-bg-secondary-dark h-40 bottom-0 z-20 [mask-image:linear-gradient(to_top,white,transparent)]" />
          </motion.div>

          {/* Background blur */}
          <div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-adam-bg-secondary-dark blur-2xl"></div>
          <div className="absolute top-1/2 z-50 h-48 w-full bg-transparent opacity-10 backdrop-blur-md"></div>

          {/* Glow orbs */}
          <div className="absolute top-0 z-50 h-32 w-[20rem] -translate-y-1/2 rounded-full bg-adam-accent opacity-20 blur-3xl"></div>
          <motion.div
            initial={{ width: "6rem" }}
            whileInView={{ width: "12rem" }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            className="absolute top-0 z-30 h-28 w-48 -translate-y-[4rem] rounded-full bg-adam-accent opacity-40 blur-2xl"
          ></motion.div>

          {/* Top line */}
          <motion.div
            initial={{ width: "12rem" }}
            whileInView={{ width: "24rem" }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            className="absolute top-0 z-50 h-px w-[24rem] -translate-y-[5rem] bg-adam-accent opacity-50"
          ></motion.div>

          {/* Top mask */}
          <div className="absolute top-0 z-40 h-44 w-full -translate-y-[10rem] bg-adam-bg-secondary-dark"></div>
        </div>
      </div>

      {/* Content — centered in remaining space */}
      <div className="relative z-50 flex flex-1 flex-col items-center justify-center px-5 w-full">
        {children}
      </div>
    </div>
  );
};
