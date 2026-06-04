CREATE TABLE `apartments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`block` varchar(50),
	`floor` int,
	`area` decimal(10,2),
	`bedrooms` int,
	`bathrooms` int,
	`direction_main` varchar(50),
	`direction_balcony` varchar(50),
	`furniture` varchar(100),
	`description` text,
	`price` bigint,
	`status` enum('trong','da_coc','da_ban') DEFAULT 'trong',
	`approval_status` enum('pending','approved','rejected') DEFAULT 'pending',
	`image` text NOT NULL,
	`folder_path` text,
	`user_id` int,
	`created_by` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `apartments_id` PRIMARY KEY(`id`),
	CONSTRAINT `apartments_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `broker_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`license_number` varchar(50),
	`company_name` varchar(255),
	`experience_years` int,
	`area_focus` text,
	`bio` text,
	`verified` int DEFAULT 0,
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `broker_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`price` int NOT NULL,
	`address` text NOT NULL,
	`author_id` int,
	`is_published` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`address` varchar(255) NOT NULL,
	`image` text,
	`status` enum('dang_xay_dung','da_ban_giao') DEFAULT 'dang_xay_dung',
	`legal` enum('so_hong','hdmb') DEFAULT 'hdmb',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullname` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` text NOT NULL,
	`role` varchar(20) NOT NULL DEFAULT 'EDITOR',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `apartments` ADD CONSTRAINT `apartments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `broker_profiles` ADD CONSTRAINT `broker_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;