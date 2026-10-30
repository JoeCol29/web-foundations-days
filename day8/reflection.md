# Reflection: Web Foundations Capstone

## Most Difficult Concept

The most difficult concept in this course was **concurrency control and preventing race conditions** in database operations. 
During the Day 7 assignment (SnapShare), I understood the theory of read replicas and caching, but applying it to a real-world 
scenario where correctness matters — like preventing two users from buying the same concert seat — was challenging. 
I overcame this by studying database transactions, isolation levels, and atomic updates. 
I learned that `UPDATE ... WHERE status = 'available'` is a simple but powerful pattern: if the row is already modified by another transaction, the update affects zero rows, and the application can gracefully return an error. 
This "optimistic locking" approach, combined with database-level foreign key constraints, ensures data integrity without requiring complex application-level locks.

## Part of the Capstone I Would Improve

Based on the feedback I received on previous assignments (particularly the truncation issues with my Markdown files), I would 
improve the **documentation quality and completeness** of my capstone. 
I noticed that my architecture diagrams and upload flows were sometimes cut off in previous submissions, which led to incomplete 
reviews. 
In this capstone, I made sure to write the entire document from scratch using the `cat > file << 'EOF'` method to avoid truncation. 
I would also improve the **error handling** in the API client (from the Day 8 assignment) by adding more specific error messages for different HTTP status codes (e.g., 409 Conflict for double-booking attempts) and providing clearer user feedback when seats are  already held.

## What I Will Learn Next

I want to learn about **event-driven architecture and message queues in depth**. 
During the capstone design, I used SQS/RabbitMQ for background jobs (email confirmations, expired hold cleanup), but I want to
understand how to build more complex event-driven systems using tools like Apache Kafka or AWS EventBridge. 
I'm also interested in learning about**real-time seat availability updates** using WebSockets, so that users can see seats being
held or sold by others in real-time during a big sale. 
This would create a more engaging and transparent user experience. Additionally, I want to explore
**infrastructure-as-code (Terraform)**to automate the deployment of the entire architecture, which would make scaling and 
replicating the system much easier.
