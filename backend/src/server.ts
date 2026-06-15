import app from './app';
import { env } from './config';

const startServer = () => {
  try {
    app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${env.PORT}`);
      console.log(`📚 Swagger Docs available at http://localhost:${env.PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();
