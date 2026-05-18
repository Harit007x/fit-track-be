import { Context } from "hono";

const todos = [
  { id: 1, title: "Learn Hono & D1", completed: true },
  { id: 2, title: "Build an Edge API", completed: true },
  { id: 3, title: "Connect with Frontend", completed: false },
];

const fetchAllTodo = async (c: Context) => {
  try {
    return c.json({ success: true, data: todos });
  } catch (error) {
    console.error("Error fetching TODO items:", error);
    return c.json({ success: false, error: "Internal Server Error" }, 500);
  }
};

export const dummyController = {
  fetchAllTodo,
};