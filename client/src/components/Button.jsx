import { motion } from "framer-motion";

const Button = ({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  ...props
}) => {
  const baseClasses =
    "px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl",
    secondary: "bg-gray-700 hover:bg-gray-600 text-white hover:shadow-xl",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl",
    danger: "bg-red-600 hover:bg-red-700 text-white hover:shadow-xl",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default Button;
