import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewtopicComponent } from './viewtopic.component';
import { TopicService } from '../services/topic.service';
import { ForumService } from '../services/forum.service';
import { CharacterService } from '../services/character.service';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { signal, WritableSignal } from '@angular/core';
import { Topic, TopicType, TopicStatus } from '../models/Topic';
import { Post } from '../models/Post';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';

@Component({
  selector: 'app-episode-create',
  template: ''
})
class MockEpisodeCreateComponent {
  @Input() initialData: any;
  @Output() formSubmit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
}

@Component({
  selector: 'app-character-create',
  template: ''
})
class MockCharacterCreateComponent {
  @Input() initialData: any;
  @Output() formSubmit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
}

describe('ViewtopicComponent', () => {
  let component: ViewtopicComponent;
  let fixture: ComponentFixture<ViewtopicComponent>;
  let topicServiceSpy: jasmine.SpyObj<TopicService>;
  let forumServiceSpy: jasmine.SpyObj<ForumService>;
  let characterServiceSpy: jasmine.SpyObj<CharacterService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  let topicSignal: WritableSignal<Topic>;
  let postsSignal: WritableSignal<Post[]>;
  let currentPageSignal: WritableSignal<{page: number, topicId: number}>;

  // Initial topic has ID 0 to trigger loadTopic when route param is 1
  const mockTopic: Topic = {
    id: 0,
    name: 'Test Topic',
    subforum_id: 1,
    date_created: '2023-01-01',
    date_last_post: '2023-01-02',
    author_user_id: 1,
    author_username: 'User1',
    post_number: 20,
    last_post_author_user_id: 1,
    last_post_author_username: 'User1',
    type: TopicType.general,
    status: TopicStatus.active,
    episode: null,
    character: null,
    can_edit: true
  };

  const mockPosts: Post[] = [
    { id: 1, topic_id: 1, user_profile: { user_id: 1, user_name: 'User1', avatar: '' }, use_character_profile: false, character_profile: null, content: 'Post 1', content_html: 'Post 1', date_created: '2023-01-01', can_edit: true },
    { id: 2, topic_id: 1, user_profile: { user_id: 2, user_name: 'User2', avatar: '' }, use_character_profile: false, character_profile: null, content: 'Post 2', content_html: 'Post 2', date_created: '2023-01-02', can_edit: false }
  ];

  beforeEach(async () => {
    topicSignal = signal(mockTopic);
    postsSignal = signal(mockPosts);
    currentPageSignal = signal({ page: 1, topicId: 1 });

    topicServiceSpy = jasmine.createSpyObj('TopicService', ['loadTopic', 'loadPosts', 'createPost', 'updatePost', 'updateLocalPost', 'updateTopic', 'updateLocalTopic'], {
      topic: topicSignal,
      posts: postsSignal,
      currentPage: currentPageSignal
    });
    forumServiceSpy = jasmine.createSpyObj('ForumService', ['loadSubforum'], {
      subforum: signal(null)
    });
    characterServiceSpy = jasmine.createSpyObj('CharacterService', ['loadUserCharacterProfilesForTopic', 'loadUserCharacterProfiles', 'loadShortCharacterList'], {
      userCharacterProfiles: signal([])
    });
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser: signal({ id: 1, username: 'User1', avatar: '', roles: [] }),
      isAdmin: signal(false)
    });

    await TestBed.configureTestingModule({
      imports: [ViewtopicComponent, CommonModule, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: TopicService, useValue: topicServiceSpy },
        { provide: ForumService, useValue: forumServiceSpy },
        { provide: CharacterService, useValue: characterServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: (key: string) => (key === 'id' ? '1' : null) }),
            queryParamMap: of({ get: (key: string) => (key === 'page' ? '1' : null) }),
            snapshot: { queryParamMap: { get: () => null } } // Mock snapshot
          }
        }
      ]
    })
    .overrideComponent(ViewtopicComponent, {
      remove: { imports: [MockEpisodeCreateComponent, MockCharacterCreateComponent] },
      add: { imports: [MockEpisodeCreateComponent, MockCharacterCreateComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewtopicComponent);
    component = fixture.componentInstance;

    // Set inputs manually since we are not running a real router navigation
    fixture.componentRef.setInput('id', 1);
    fixture.componentRef.setInput('pageNumber', 1);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load topic and posts on init', () => {
    expect(topicServiceSpy.loadTopic).toHaveBeenCalledWith(1);
    expect(topicServiceSpy.loadPosts).toHaveBeenCalledWith(1, 1, undefined);
  });

  it('should display topic title', () => {
    // We need to update the signal to reflect the loaded topic for the template to render it
    topicSignal.set({ ...mockTopic, id: 1 });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Test Topic');
  });

  it('should display posts', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const posts = compiled.querySelectorAll('.post');
    expect(posts.length).toBe(2);
  });

  it('should show edit link for editable post', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const posts = compiled.querySelectorAll('.post');
    const firstPostLinks = posts[0].querySelector('.post-links');
    expect(firstPostLinks?.textContent).toContain('Edit');
  });

  it('should not show edit link for non-editable post', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const posts = compiled.querySelectorAll('.post');
    const secondPostLinks = posts[1].querySelector('.post-links');
    expect(secondPostLinks?.textContent).not.toContain('Edit');
  });

  it('should show edit link for topic header when can_edit is true', () => {
    // Ensure topic is loaded and has can_edit = true
    topicSignal.set({ ...mockTopic, id: 1, can_edit: true });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const headerEdit = compiled.querySelector('.main-header a');
    expect(headerEdit?.textContent).toContain('[Edit]');
  });

  it('should toggle edit mode for topic', () => {
    component.editTopic(new Event('click'));
    expect(component.editingTopic()).toBeTrue();

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input[name="title"]');
    expect(input).toBeTruthy();
  });

  it('should calculate total pages correctly', () => {
    // 20 posts, 15 per page -> 2 pages
    expect(component.totalPages()).toBe(2);
  });

  it('should show pagination when pages > 1', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const pagination = compiled.querySelector('.pagelink');
    expect(pagination?.textContent).toContain('Pages');
  });
});
