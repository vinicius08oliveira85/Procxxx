import { motion, type HTMLMotionProps } from 'motion/react';

const spring = { type: 'spring' as const, stiffness: 420, damping: 26 };

/**
 * Botão com micro-interação Fluent no toque. O hover fica a cargo do CSS do
 * próprio botão (`fluent-button-*`), para não haver dois efeitos simultâneos.
 */
export function FluentPressableButton({ className, ...props }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={className}
      {...props}
    />
  );
}

/**
 * Cartão ou linha de lista com resposta ao toque. O hover (fundo, borda, sombra)
 * vem do CSS do cartão — o `scale` duplicava esse feedback.
 */
export function FluentPressableDiv({ className, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={className}
      {...props}
    />
  );
}
