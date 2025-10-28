import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface TypewriterNeighborhoodsProps {
  neighborhoods: string[];
  className?: string;
}

export function TypewriterNeighborhoods({ neighborhoods, className = "" }: TypewriterNeighborhoodsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  const validNeighborhoods = neighborhoods.length > 0 ? neighborhoods : ["CAMBURI"];
  const currentWord = validNeighborhoods[currentIndex];
  
  const typingSpeed = 100;
  const deletingSpeed = 60;
  const pauseDuration = 2000;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDeleting) {
        // Digitando
        if (displayText.length < currentWord.length) {
          setDisplayText(currentWord.substring(0, displayText.length + 1));
        } else {
          // Terminou de digitar, aguarda e depois começa a apagar
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        // Apagando
        if (displayText.length > 0) {
          setDisplayText(currentWord.substring(0, displayText.length - 1));
        } else {
          // Terminou de apagar, vai para o próximo
          setIsDeleting(false);
          setCurrentIndex((prev) => (prev + 1) % validNeighborhoods.length);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentWord, validNeighborhoods.length]);

  return (
    <span className={`relative inline-block ${className}`}>
      <span className="inline-block min-w-[2ch]">
        {displayText}
        <motion.span
          className="inline-block w-[3px] h-[0.9em] bg-white ml-1 -mb-[2px]"
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatType: "loop",
            times: [0, 0.5, 0.5, 1],
          }}
        />
      </span>
    </span>
  );
}
