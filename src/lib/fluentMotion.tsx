import { motion, type HTMLMotionProps } from 'motion/react';

const spring = { type: 'spring' as const, stiffness: 420, damping: 26 };

/** Botão com micro-interação Fluent (hover / tap). */
export function FluentPressableButton({ className, ...props }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={className}
      {...props}
    />
  );
}

/** Cartão ou linha de lista com leve resposta ao hover/tap. */
export function FluentPressableDiv({ className, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={className}
      {...props}
    />
  );
}
