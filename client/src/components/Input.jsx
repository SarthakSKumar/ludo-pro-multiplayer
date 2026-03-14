import { forwardRef } from "react";

const Input = forwardRef(({ label, error, className = "", ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`input-field ${error ? "border-red-500 ring-2 ring-red-500" : ""} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";

export default Input;
